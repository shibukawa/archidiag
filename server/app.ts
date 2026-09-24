// system:bun-server: serves the frontend, the project store over REST, the collaboration gateway over WebSocket,
// and the MCP server over streamable HTTP. Every modeling feature still works on the static build without it.
import { timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import type { Server, ServerWebSocket } from 'bun'
import { parseProject, serializeProject } from '../src/core/io'
import type { Project } from '../src/core/model'
import { McpServer, SERVER_VERSION, type Identity, type McpSession } from './mcp'
import { Room, type Connection, type Role } from './room'
import { ProjectStore, StoreError } from './store'

export interface TokenGrant { token: string; name: string; role: Role }

export interface ServerOptions {
  root: string
  port?: number
  host?: string
  /** Shared mode: every request must carry one of these tokens. Without tokens the server is local and open. */
  tokens?: TokenGrant[]
  workspace?: boolean
  staticDir?: string
  /** Files embedded in a compiled executable, keyed by URL path. */
  assets?: Map<string, Blob>
  allowAnonymous?: boolean
  allowedOrigins?: string[]
  clearStaleLock?: boolean
  log?: (message: string) => void
}

interface SocketData { projectId: string; identity: Identity; connection?: Connection; color: string }

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])
const COLORS = ['#55d5e6', '#f7c873', '#a68bfa', '#f47c8b', '#55d6a1', '#63b3ed', '#f59e0b', '#ec4899']

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
const problem = (message: string, status: number) => json({ error: message }, status)

/** Compares secrets in time that does not depend on where they differ. */
function sameSecret(expected: string, given: string) {
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

function colorFor(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}

export function startServer(options: ServerOptions) {
  const log = options.log ?? ((message: string) => console.error(message))
  const host = options.host ?? '127.0.0.1'
  const tokens = options.tokens ?? []
  if (!LOOPBACK.has(host) && !tokens.length && !options.allowAnonymous) throw new Error(`Binding ${host} shares the projects on the network; give --token name:secret[:read_only] for each user, or --allow-anonymous`)
  const store = new ProjectStore(options.root, { workspace: options.workspace })
  store.lock({ clearStale: options.clearStaleLock })
  try {
    return serve(options, store, log, host, tokens)
  } catch (error) {
    store.unlock()
    throw error
  }
}

const ROOM_IDLE_MS = 60_000

function serve(options: ServerOptions, store: ProjectStore, log: (message: string) => void, host: string, tokens: TokenGrant[]) {
  const rooms = new Map<string, Room>()
  const openRoom = (projectId: string) => {
    let room = rooms.get(projectId)
    if (!room) {
      room = Room.open(store, projectId, log)
      rooms.set(projectId, room)
    }
    return room
  }
  const readProject = (projectId: string) => rooms.get(projectId)?.project() ?? store.read(projectId)
  const mcp = new McpServer({ store, openRoom, readProject, log })
  // Rooms nobody uses any more are saved and closed.
  const sweeper = setInterval(() => {
    const now = Date.now()
    rooms.forEach((room, id) => { if (room.idle(now, ROOM_IDLE_MS)) { room.close(); rooms.delete(id) } })
  }, ROOM_IDLE_MS / 2)
  const staticDir = resolve(options.staticDir ?? join(import.meta.dir, '..', 'dist'))

  /** Local mode: the person at this machine, named by the browser. Shared mode: the token's user. */
  const identify = (request: Request, url: URL): Identity | undefined => {
    if (!tokens.length) {
      const header = request.headers.get('x-c4sketch-user')
      const name = (url.searchParams.get('name') ?? (header ? (() => { try { return decodeURIComponent(header) } catch { return header } })() : '')).trim().slice(0, 40) || 'Local user'
      return { id: `local:${name}`, name, role: 'edit' }
    }
    const header = request.headers.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token') ?? ''
    const grant = tokens.find((candidate) => sameSecret(candidate.token, token))
    return grant ? { id: `user:${grant.name}`, name: grant.name, role: grant.role } : undefined
  }

  /**
   * Without login the server answers only requests addressed to a loopback name, so a site that rebinds its own
   * domain to 127.0.0.1 cannot reach it; browsers from another origin need to be listed.
   */
  const originAllowed = (request: Request, url: URL) => {
    if (!tokens.length && !LOOPBACK.has(url.hostname.replace(/^\[|\]$/g, ''))) return false
    const origin = request.headers.get('origin')
    if (!origin) return true
    try { return new URL(origin).host === url.host || (options.allowedOrigins ?? []).includes(origin) } catch { return false }
  }
  /** CORS headers for an origin given with --allow-origin. */
  const corsFor = (request: Request): Record<string, string> => {
    const origin = request.headers.get('origin')
    if (!origin || !(options.allowedOrigins ?? []).includes(origin)) return {}
    return { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, mcp-session-id, mcp-protocol-version, x-c4sketch-user', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'access-control-expose-headers': 'mcp-session-id', vary: 'origin' }
  }

  const readBody = async (request: Request) => { try { return await request.json() as Record<string, unknown> } catch { throw new StoreError('Body is not JSON') } }

  const api = async (request: Request, url: URL, identity: Identity): Promise<Response> => {
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const [, resource, projectId, sub, subId, action] = parts
    if (resource === 'health') return json({ server: 'c4sketch', version: SERVER_VERSION, auth: tokens.length ? 'token' : 'none', mode: store.mode, canCreate: store.mode === 'workspace' })
    if (resource === 'session') return json({ user: { id: identity.id, name: identity.name, color: colorFor(identity.id) }, role: identity.role })
    if (resource !== 'projects') return problem('Not found', 404)
    const edit = () => { if (identity.role === 'read_only') throw new StoreError('Read-only participants cannot change projects', 403) }
    if (!projectId) {
      if (request.method === 'GET') return json({ projects: store.list().map(({ id, name }) => ({ id, name, participants: rooms.get(id)?.participants().length ?? 0 })) })
      if (request.method === 'POST') {
        edit()
        const body = await readBody(request)
        const project = body.project ? parseProject(JSON.stringify(body.project)) : undefined
        const created = store.create(String(body.name ?? project?.name ?? 'Untitled'), project)
        return json({ id: created.id, name: created.name }, 201)
      }
      return problem('Method not allowed', 405)
    }
    const room = openRoom(projectId)
    if (!sub) {
      if (request.method === 'GET') return new Response(serializeProject(room.project()), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${projectId}.json"` } })
      if (request.method === 'PUT') {
        edit()
        const next: Project = parseProject(JSON.stringify(await readBody(request)))
        room.applyAs({ id: identity.id, name: identity.name, kind: 'human' }, { ...next, id: room.project().id })
        return json({ ok: true, revision: room.revision })
      }
      return problem('Method not allowed', 405)
    }
    if (sub === 'journal' && request.method === 'GET') return json({ entries: store.readJournal(projectId, Number(url.searchParams.get('limit') ?? 100)) })
    if (sub === 'agents' && subId && action === 'undo' && request.method === 'POST') {
      edit()
      return json({ undone: room.undoAgent(subId), revision: room.revision })
    }
    return problem('Not found', 404)
  }

  const mcpRequest = async (request: Request, identity: Identity): Promise<Response> => {
    if (request.method === 'GET') return new Response('This server answers MCP requests with JSON; open no event stream', { status: 405, headers: { allow: 'POST, DELETE' } })
    const header = request.headers.get('mcp-session-id')
    const existing: McpSession | undefined = header ? mcp.sessions.get(header) : undefined
    if (existing && existing.identity.id !== identity.id) return problem('The MCP session belongs to another user', 403)
    if (request.method === 'DELETE') { if (existing) mcp.sessions.delete(existing.id); return new Response(null, { status: 204 }) }
    if (request.method !== 'POST') return problem('Method not allowed', 405)
    let payload: unknown
    try { payload = await request.json() } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400) }
    if (header && !existing) return problem('Unknown MCP session; initialize again', 404)
    // A session begins with initialize; any other first request is refused rather than opening a session.
    const initializing = (Array.isArray(payload) ? payload : [payload]).some((message) => (message as { method?: string })?.method === 'initialize')
    if (!existing && !initializing) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Send initialize first; then pass its mcp-session-id header' } }, 400)
    const session = existing ?? mcp.createSession(identity)
    const response = await mcp.handle(payload, session)
    const headers = { 'mcp-session-id': session.id }
    return response === undefined ? new Response(null, { status: 202, headers }) : json(response, 200, headers)
  }

  const serveStatic = async (url: URL): Promise<Response> => {
    const path = url.pathname === '/' ? '/index.html' : url.pathname
    const embedded = options.assets?.get(path) ?? (options.assets && !path.includes('.') ? options.assets.get('/index.html') : undefined)
    if (embedded) return new Response(embedded)
    const file = normalize(join(staticDir, path))
    if (file.startsWith(staticDir) && existsSync(file) && !file.endsWith('/')) return new Response(Bun.file(file))
    const index = join(staticDir, 'index.html')
    if (!path.includes('.') && existsSync(index)) return new Response(Bun.file(index))
    return new Response(existsSync(index) ? 'Not found' : 'The frontend is not built; run npm run build', { status: 404 })
  }

  /** Health, WebSocket upgrades, MCP, and REST, after the origin check. Undefined means the socket was upgraded. */
  const route = async (request: Request, url: URL, bunServer: Server<SocketData>): Promise<Response | undefined> => {
    if (url.pathname === '/api/health') return api(request, url, { id: 'anonymous', name: 'anonymous', role: 'read_only' })
    const identity = identify(request, url)
    if (!identity) return problem('Log in with a token', 401)
    try {
      const collab = url.pathname.match(/^\/api\/collab\/([^/]+)$/)
      if (collab) {
        const projectId = decodeURIComponent(collab[1])
        store.dirOf(projectId)
        const color = /^#[0-9a-f]{6}$/i.test(url.searchParams.get('color') ?? '') ? url.searchParams.get('color')! : colorFor(identity.id)
        return bunServer.upgrade(request, { data: { projectId, identity, color } }) ? undefined : problem('Expected a WebSocket upgrade', 426)
      }
      if (url.pathname === '/mcp') return await mcpRequest(request, identity)
      return await api(request, url, identity)
    } catch (error) {
      if (error instanceof StoreError) return problem(error.message, error.status)
      log(`request failed: ${error instanceof Error ? error.stack : String(error)}`)
      return problem(error instanceof Error ? error.message : String(error), 500)
    }
  }

  const server = Bun.serve<SocketData, never>({
    port: options.port ?? 8787,
    hostname: host,
    async fetch(request, bunServer) {
      const url = new URL(request.url)
      const isApi = url.pathname.startsWith('/api/') || url.pathname === '/mcp'
      if (!isApi) return serveStatic(url)
      if (!originAllowed(request, url)) return problem('Origin not allowed', 403)
      const cors = corsFor(request)
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
      const response = await route(request, url, bunServer)
      if (response) Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value))
      return response as Response
    },
    websocket: {
      maxPayloadLength: 64 * 1024 * 1024,
      open(ws: ServerWebSocket<SocketData>) {
        const room = openRoom(ws.data.projectId)
        const connection: Connection = { send: (data) => { ws.send(data) }, actor: { id: ws.data.identity.id, name: ws.data.identity.name, kind: 'human', color: ws.data.color }, role: ws.data.identity.role, clientIds: new Set() }
        ws.data.connection = connection
        room.join(connection)
      },
      message(ws: ServerWebSocket<SocketData>, message) {
        const connection = ws.data.connection
        if (!connection || typeof message === 'string') return
        try { openRoom(ws.data.projectId).receive(connection, new Uint8Array(message)) } catch (error) { log(`collab message failed: ${String(error)}`) }
      },
      close(ws: ServerWebSocket<SocketData>) {
        if (ws.data.connection) rooms.get(ws.data.projectId)?.leave(ws.data.connection)
      },
    },
  })

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(sweeper)
    server.stop(true)
    rooms.forEach((room) => room.close())
    rooms.clear()
    store.unlock()
  }
  return { server, url: `http://${host.includes(':') ? `[${host}]` : host}:${server.port}`, port: server.port, store, rooms, mcp, openRoom, stop }
}

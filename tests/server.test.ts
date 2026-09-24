import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import * as commands from '../src/core/commands'
import { readProject, writeProject } from '../src/core/crdt'
import { serializeProject } from '../src/core/io'
import { commerceStarter } from '../src/core/starter'
import { projectToFiles } from '../src/core/yamlStore'
import { startServer } from '../server/app'

const cleanups: Array<() => void> = []
afterEach(() => { while (cleanups.length) cleanups.pop()!() })

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check: () => boolean, timeout = 3000) {
  const start = Date.now()
  while (!check()) { if (Date.now() - start > timeout) throw new Error('timed out'); await wait(20) }
}

/** A project folder seeded with the starter, served on a free port. */
function serve(extra: Partial<Parameters<typeof startServer>[0]> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'c4sketch-'))
  Object.entries(projectToFiles(commerceStarter())).forEach(([path, content]) => { const file = join(root, path); require('node:fs').mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, content) })
  const running = startServer({ root, port: 0, log: () => undefined, staticDir: join(root, 'no-dist'), ...extra })
  cleanups.push(() => { running.stop(); rmSync(root, { recursive: true, force: true }) })
  return { root, running, projectId: running.store.list()[0].id }
}

function client(url: string, projectId: string, params: Record<string, string> = {}) {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(url.replace('http', 'ws') + '/api/collab', projectId, doc, { params, WebSocketPolyfill: WebSocket as never, disableBc: true })
  cleanups.push(() => { provider.destroy(); doc.destroy() })
  return { doc, provider, synced: () => new Promise<void>((resolve) => { if (provider.synced) resolve(); else provider.once('sync', () => resolve()) }) }
}

async function mcp(url: string, body: unknown, session?: string, token?: string) {
  const response = await fetch(`${url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...(session ? { 'mcp-session-id': session } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  return { status: response.status, session: response.headers.get('mcp-session-id') ?? undefined, body: response.status === 202 ? undefined : await response.json() as { result?: { content: Array<{ text: string }>; isError?: boolean; tools?: Array<{ name: string }>; contents?: Array<{ text: string }> }; error?: unknown } }
}

describe('server', () => {
  test('health and project listing', async () => {
    const { running, projectId } = serve()
    const health = await (await fetch(`${running.url}/api/health`)).json() as { auth: string; mode: string }
    expect(health).toMatchObject({ auth: 'none', mode: 'single' })
    const list = await (await fetch(`${running.url}/api/projects`)).json() as { projects: Array<{ id: string; name: string }> }
    expect(list.projects).toEqual([{ id: projectId, name: 'Commerce Platform', participants: 0 } as never])
  })

  test('two browsers converge, with attribution, and the folder is saved', async () => {
    const { running, projectId, root } = serve()
    const a = client(running.url, projectId, { name: 'Alice' })
    const b = client(running.url, projectId, { name: 'Bob' })
    await Promise.all([a.synced(), b.synced()])
    const pa = readProject(a.doc)!
    const pb = readProject(b.doc)!
    expect(pa.elements['person:customer'].name).toBe('Customer')
    writeProject(a.doc, commands.patchElement(pa, 'container:web', { description: 'from Alice' }), pa)
    writeProject(b.doc, commands.patchElement(pb, 'container:web', { technology: 'from Bob' }), pb)
    await until(() => readProject(a.doc)!.elements['container:web'].technology === 'from Bob' && readProject(b.doc)!.elements['container:web'].description === 'from Alice')
    expect(serializeProject(readProject(a.doc)!)).toBe(serializeProject(readProject(b.doc)!))
    await until(() => readFileSync(join(root, 'elements', 'container_web.yaml'), 'utf8').includes('from Bob'), 4000)
    expect(readFileSync(join(root, 'elements', 'container_web.yaml'), 'utf8')).toContain('from Alice')
    const activity = () => ([...a.provider.awareness.getStates().values()].find((state) => (state as { server?: boolean }).server) as { activity?: Array<{ actor: { name: string } }> } | undefined)?.activity ?? []
    await until(() => activity().length >= 2, 4000)
    const actors = activity().map((entry) => entry.actor.name)
    expect(actors).toContain('Alice')
    expect(actors).toContain('Bob')
    expect(existsSync(join(root, '.journal', 'journal.jsonl'))).toBe(true)
  })

  test('presence lists the participants', async () => {
    const { running, projectId } = serve()
    const a = client(running.url, projectId, { name: 'Alice' })
    const b = client(running.url, projectId, { name: 'Bob' })
    await Promise.all([a.synced(), b.synced()])
    a.provider.awareness.setLocalStateField('user', { name: 'Alice' })
    await until(() => [...b.provider.awareness.getStates().values()].some((state) => (state as { user?: { name: string } }).user?.name === 'Alice'))
  })

  test('an MCP edit appears live in a browser and undoes as one step', async () => {
    const { running, projectId } = serve()
    const browser = client(running.url, projectId, { name: 'Alice' })
    await browser.synced()
    const init = await mcp(running.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'test-agent' }, capabilities: {} } })
    expect(init.session).toBeTruthy()
    expect((await mcp(running.url, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.session)).status).toBe(202)
    const tools = await mcp(running.url, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, init.session)
    const names = tools.body!.result!.tools!.map((tool) => tool.name)
    expect(names).toContain('create_element')
    expect(names).toContain('merge_domains')
    expect(names).not.toContain('open_view')
    const created = await mcp(running.url, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'create_element', arguments: { name: 'Search Service', kind: 'container', parentId: 'system:commerce', technology: 'Go' } } }, init.session)
    expect(created.body!.result!.isError).toBe(false)
    const { result, revision } = JSON.parse(created.body!.result!.content[0].text) as { result: { id: string }; revision: number }
    expect(revision).toBeGreaterThan(0)
    await until(() => Boolean(readProject(browser.doc)!.elements[result.id]))
    await until(() => [...browser.provider.awareness.getStates().values()].some((state) => (state as { user?: { kind: string } }).user?.kind === 'agent'))
    const undone = await mcp(running.url, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'undo_last_edit', arguments: {} } }, init.session)
    expect(JSON.parse(undone.body!.result!.content[0].text).undone).toBe(true)
    await until(() => !readProject(browser.doc)!.elements[result.id])
  })

  test('a failing MCP call changes nothing', async () => {
    const { running } = serve()
    const before = serializeProject(running.openRoom(running.store.list()[0].id).project())
    const init = await mcp(running.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    const failed = await mcp(running.url, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_element', arguments: { name: 'Orphan', kind: 'component' } } }, init.session)
    expect(failed.body!.result!.isError).toBe(true)
    expect(serializeProject(running.openRoom(running.store.list()[0].id).project())).toBe(before)
    const unknown = await mcp(running.url, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } }, init.session)
    expect(unknown.body!.error).toBeDefined()
  })

  test('MCP resources return the project, findings, DDL, and a diagram', async () => {
    const { running, projectId } = serve()
    const init = await mcp(running.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    const listed = await mcp(running.url, { jsonrpc: '2.0', id: 2, method: 'resources/list' }, init.session)
    const uris = (listed.body!.result as unknown as { resources: Array<{ uri: string }> }).resources.map((resource) => resource.uri)
    expect(uris).toContain(`project://${projectId}/findings`)
    const ddl = await mcp(running.url, { jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: `project://${projectId}/ddl/container:orders-db` } }, init.session)
    expect(ddl.body!.result!.contents![0].text).toContain('CREATE TABLE customer')
    const diagram = uris.find((uri) => uri.includes('/diagram/'))!
    const svg = await mcp(running.url, { jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: diagram } }, init.session)
    expect(svg.body!.result!.contents![0].text.startsWith('<svg')).toBe(true)
  })

  test('shared mode requires a token and enforces read-only', async () => {
    const { running, projectId } = serve({ tokens: [{ token: 'alice-secret', name: 'Alice', role: 'edit' }, { token: 'guest-secret', name: 'Guest', role: 'read_only' }] })
    expect((await fetch(`${running.url}/api/projects`)).status).toBe(401)
    expect((await fetch(`${running.url}/api/projects`, { headers: { authorization: 'Bearer alice-secret' } })).status).toBe(200)
    const editor = client(running.url, projectId, { token: 'alice-secret' })
    const guest = client(running.url, projectId, { token: 'guest-secret' })
    await Promise.all([editor.synced(), guest.synced()])
    const pg = readProject(guest.doc)!
    writeProject(guest.doc, commands.patchElement(pg, 'person:ops', { name: 'Hacked' }), pg)
    const pe = readProject(editor.doc)!
    writeProject(editor.doc, commands.patchElement(pe, 'person:customer', { name: 'Shopper' }), pe)
    await until(() => readProject(guest.doc)!.elements['person:customer'].name === 'Shopper')
    await wait(200)
    expect(readProject(editor.doc)!.elements['person:ops'].name).toBe('Operations Staff')
    expect(running.openRoom(projectId).project().elements['person:ops'].name).toBe('Operations Staff')
    const init = await mcp(running.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, undefined, 'guest-secret')
    const denied = await mcp(running.url, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_element', arguments: { name: 'X', kind: 'person' } } }, init.session, 'guest-secret')
    expect(denied.body!.result!.isError).toBe(true)
  })

  test('a restart keeps the CRDT history and picks up files edited on disk', async () => {
    const root = mkdtempSync(join(tmpdir(), 'c4sketch-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    let running = startServer({ root, port: 0, log: () => undefined })
    const projectId = running.store.list()[0].id
    const a = client(running.url, projectId, { name: 'Alice' })
    await a.synced()
    const pa = readProject(a.doc)!
    writeProject(a.doc, commands.createElement(pa, { kind: 'person', name: 'Auditor', description: '', technology: '' }).project, pa)
    await until(() => running.openRoom(projectId).project().name === pa.name && Object.values(running.openRoom(projectId).project().elements).some((element) => element.name === 'Auditor'))
    a.provider.destroy()
    running.stop()
    const header = join(root, 'c4sketch.yaml')
    writeFileSync(header, readFileSync(header, 'utf8').replace(/^name: .*$/m, 'name: Renamed on disk'))
    running = startServer({ root, port: 0, log: () => undefined })
    cleanups.push(() => running.stop())
    const project = running.openRoom(projectId).project()
    expect(project.name).toBe('Renamed on disk')
    expect(Object.values(project.elements).some((element) => element.name === 'Auditor')).toBe(true)
  })

  test('a second server on the same folder is refused', () => {
    const { root } = serve()
    expect(() => startServer({ root, port: 0, log: () => undefined })).toThrow(/locked/)
  })
})

describe('server hardening', () => {
  test('a read-only MCP session cannot change the project, not even by opening a scope', async () => {
    const { running, projectId } = serve({ tokens: [{ token: 'guest-secret', name: 'Guest', role: 'read_only' }] })
    const before = serializeProject(running.openRoom(projectId).project())
    const init = await mcp(running.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, undefined, 'guest-secret')
    const entered = await mcp(running.url, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'enter_scope', arguments: { elementId: 'container:events' } } }, init.session, 'guest-secret')
    expect(entered.body!.result!.isError).toBe(true)
    expect(serializeProject(running.openRoom(projectId).project())).toBe(before)
  })

  test('without login only loopback host names are answered', async () => {
    const { running } = serve()
    const port = new URL(running.url).port
    const rebound = await fetch(`http://127.0.0.1:${port}/api/projects`, { headers: { host: `evil.example:${port}`, origin: `http://evil.example:${port}` } })
    expect(rebound.status).toBe(403)
    expect((await fetch(`http://localhost:${port}/api/projects`)).status).toBe(200)
  })

  test('an MCP session starts with initialize', async () => {
    const { running } = serve()
    const early = await mcp(running.url, { jsonrpc: '2.0', id: 1, method: 'tools/list' })
    expect(early.status).toBe(400)
    expect(running.mcp.sessions.size).toBe(0)
  })

  test('an unknown project opens no room', async () => {
    const { running } = serve()
    expect((await fetch(`${running.url}/api/projects/nope`)).status).toBe(404)
    expect(running.rooms.size).toBe(0)
  })

  test('a participant cannot pose as someone else', async () => {
    const { running, projectId } = serve({ tokens: [{ token: 'a', name: 'Alice', role: 'edit' }, { token: 'm', name: 'Mallory', role: 'edit' }] })
    const alice = client(running.url, projectId, { token: 'a' })
    const mallory = client(running.url, projectId, { token: 'm' })
    await Promise.all([alice.synced(), mallory.synced()])
    mallory.provider.awareness.setLocalStateField('user', { name: 'Alice', kind: 'agent' })
    await wait(300)
    const names = [...alice.provider.awareness.getStates().values()].map((state) => (state as { user?: { name: string; kind: string } }).user).filter(Boolean)
    expect(names.some((user) => user!.name === 'Mallory' && user!.kind === 'human')).toBe(true)
    expect(names.filter((user) => user!.name === 'Alice').length).toBeLessThanOrEqual(1)
  })
})

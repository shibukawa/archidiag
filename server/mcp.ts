// api:mcp-server: the shared tool surface, project resources, and findings over the Model Context Protocol
// (JSON-RPC 2.0), for streamable HTTP and stdio. An agent is one more editor (rule:ai-change-consent): a tool call
// runs on a working copy and, when it succeeds, lands as one transaction and one undo step in the live document.
import { buildDdl } from '../src/core/ddl'
import { serializeProject } from '../src/core/io'
import { isErdStore } from '../src/core/model'
import { buildRenderModel, renderSvg } from '../src/core/render'
import { THEMES } from '../src/core/theme'
import { createToolHost, READ_ONLY_TOOLS, toolDefinitions, type ToolDefinition } from '../src/core/tools'
import { allFindings } from '../src/core/validate'
import { COPY, renderLabels } from '../src/ui/i18n'
import type { Project } from '../src/core/model'
import type { Role, Room } from './room'
import type { ProjectStore } from './store'

export const MCP_PROTOCOL_VERSION = '2025-06-18'
const SUPPORTED_VERSIONS = [MCP_PROTOCOL_VERSION, '2025-03-26', '2024-11-05']
const SESSION_IDLE_MS = 60 * 60 * 1000
export const SERVER_VERSION = '0.2.0'

export interface Identity { id: string; name: string; role: Role }

export interface McpSession {
  id: string
  identity: Identity
  clientName: string
  projectId?: string
  lastUsed: number
}

interface JsonRpcRequest { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }
type JsonRpcResponse = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } }

export interface McpContext {
  store: ProjectStore
  openRoom: (projectId: string) => Room
  /** The project as saved or, when its room is open, as edited now; opening no room for it. */
  readProject: (projectId: string) => Project
  log: (message: string) => void
}

class ToolError extends Error {}

const text = (value: unknown) => ({ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) })

/** Tools only the server has: which project a session works on, and undo of the agent's own edits. */
const SERVER_TOOLS = [
  { name: 'list_projects', title: 'List projects', description: 'Projects this server holds, with the one this session works on.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'open_project', title: 'Open project', description: 'Choose the project the following tool calls work on.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'], additionalProperties: false } },
  { name: 'undo_last_edit', title: 'Undo last edit', description: 'Undo this session’s latest edit. Only your own edits are undone; other participants’ changes stay (rule:undo-scope).', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
]

export class McpServer {
  readonly sessions = new Map<string, McpSession>()

  constructor(private readonly context: McpContext) {}

  createSession(identity: Identity, clientName = 'MCP client'): McpSession {
    const now = Date.now()
    this.sessions.forEach((other, id) => { if (now - other.lastUsed > SESSION_IDLE_MS) this.sessions.delete(id) })
    const session: McpSession = { id: crypto.randomUUID(), identity, clientName, lastUsed: now }
    this.sessions.set(session.id, session)
    return session
  }

  /** Handles one message or a batch; returns undefined when only notifications arrived. */
  async handle(payload: unknown, session: McpSession): Promise<JsonRpcResponse | JsonRpcResponse[] | undefined> {
    session.lastUsed = Date.now()
    if (Array.isArray(payload)) {
      const responses = (await Promise.all(payload.map((message) => this.handleOne(message, session)))).filter((response): response is JsonRpcResponse => Boolean(response))
      return responses.length ? responses : undefined
    }
    return this.handleOne(payload, session)
  }

  private async handleOne(message: unknown, session: McpSession): Promise<JsonRpcResponse | undefined> {
    const request = message as JsonRpcRequest
    if (!request || typeof request !== 'object' || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid JSON-RPC request' } }
    }
    const isNotification = request.id === undefined
    try {
      const result = await this.dispatch(request, session)
      return isNotification ? undefined : { jsonrpc: '2.0', id: request.id ?? null, result }
    } catch (error) {
      if (isNotification) return undefined
      const code = error instanceof MethodNotFound ? -32601 : error instanceof InvalidParams ? -32602 : -32603
      return { jsonrpc: '2.0', id: request.id ?? null, error: { code, message: error instanceof Error ? error.message : String(error) } }
    }
  }

  private async dispatch(request: JsonRpcRequest, session: McpSession): Promise<unknown> {
    const params = request.params ?? {}
    switch (request.method) {
      case 'initialize': {
        const client = params.clientInfo as { name?: string } | undefined
        if (client?.name) session.clientName = client.name
        return {
          protocolVersion: SUPPORTED_VERSIONS.includes(String(params.protocolVersion)) ? params.protocolVersion : MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
          serverInfo: { name: 'c4sketch', title: 'C4Sketch', version: SERVER_VERSION },
          instructions: 'C4Sketch architecture model: C4 elements, ERDs, DFDs, vocabulary, and domains. Call list_projects and open_project first when the server holds several projects. Edits apply directly and appear live in connected browsers; undo_last_edit reverts your own latest edit.',
        }
      }
      case 'ping':
        return {}
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return undefined
      case 'tools/list':
        return { tools: this.toolList() }
      case 'tools/call':
        return this.callTool(String(params.name ?? ''), (params.arguments as Record<string, unknown>) ?? {}, session)
      case 'resources/list':
        return { resources: this.resourceList(session) }
      case 'resources/templates/list':
        return { resourceTemplates: [
          { uriTemplate: 'project://{projectId}', name: 'Project', mimeType: 'application/json' },
          { uriTemplate: 'project://{projectId}/findings', name: 'Check findings', mimeType: 'application/json' },
          { uriTemplate: 'project://{projectId}/diagram/{viewId}', name: 'Diagram SVG', mimeType: 'image/svg+xml' },
          { uriTemplate: 'project://{projectId}/ddl/{dataStoreId}', name: 'SQL DDL', mimeType: 'application/sql' },
        ] }
      case 'resources/read':
        return this.readResource(String(params.uri ?? ''))
      default:
        throw new MethodNotFound(`Unknown method ${request.method}`)
    }
  }

  private toolList() {
    const shared = toolDefinitions(createToolHost({ getProject: () => { throw new Error('unused') }, apply: () => undefined, log: () => undefined }))
      .filter((tool) => tool.name !== 'open_view')
    return [...SERVER_TOOLS.map((tool) => ({ ...tool, annotations: { readOnlyHint: tool.name === 'list_projects' } })), ...shared.map((tool) => ({ name: tool.name, title: tool.title, description: tool.description, inputSchema: tool.inputSchema, annotations: { readOnlyHint: READ_ONLY_TOOLS.has(tool.name) } }))]
  }

  private projectIdFor(session: McpSession): string {
    if (session.projectId) return session.projectId
    const projects = this.context.store.list()
    if (projects.length === 1) return projects[0].id
    throw new ToolError(projects.length ? `Several projects: call open_project with one of ${projects.map((project) => project.id).join(', ')}` : 'The server holds no project yet')
  }

  private async callTool(name: string, args: Record<string, unknown>, session: McpSession) {
    try {
      if (name === 'list_projects') return { content: [text({ projects: this.context.store.list().map(({ id, name: title }) => ({ id, name: title })), current: session.projectId ?? null })] }
      if (name === 'open_project') {
        const projectId = String(args.projectId ?? '')
        this.context.store.dirOf(projectId)
        session.projectId = projectId
        this.context.openRoom(projectId)
        return { content: [text({ ok: true, projectId })] }
      }
      const room = this.context.openRoom(this.projectIdFor(session))
      const agent = room.agent(session.id, { id: `agent:${session.id}`, name: `${session.clientName} (${session.identity.name})`, kind: 'agent', onBehalfOf: session.identity.name, color: '#a68bfa' })
      if (name === 'undo_last_edit') {
        if (session.identity.role === 'read_only') throw new ToolError('Read-only participants cannot edit')
        const undone = room.undoAgent(session.id)
        return { content: [text({ undone, revision: room.revision })] }
      }
      const readOnly = READ_ONLY_TOOLS.has(name)
      if (!readOnly && session.identity.role === 'read_only') throw new ToolError(`${name} edits the project; this session is read-only`)
      // A working copy: the tool's edits land together when it succeeds, and not at all when it fails.
      const original = room.project()
      let working = original
      const logged: Array<Record<string, unknown>> = []
      const host = createToolHost({ getProject: () => working, apply: (update) => { working = update(working) }, log: (tool, action, payload) => logged.push({ tool, action, ...payload }) })
      const tool: ToolDefinition | undefined = toolDefinitions(host).find((candidate) => candidate.name === name && candidate.name !== 'open_view')
      if (!tool) throw new InvalidParams(`Unknown tool ${name}`)
      const result = await tool.execute(args)
      const failed = Boolean(result && typeof result === 'object' && 'error' in (result as object))
      if (!failed && working !== original && session.identity.role === 'read_only') throw new ToolError(`${name} would change the project; this session is read-only`)
      if (!failed && working !== original) {
        room.applyAsAgent(agent, working)
        logged.forEach((entry) => this.context.log(`[MCP edit] ${JSON.stringify({ timestamp: new Date().toISOString(), source: 'MCP', project: room.id, actor: agent.actor.name, revision: room.revision, ...entry })}`))
      }
      return { content: [text({ result, revision: room.revision })], structuredContent: { result, revision: room.revision }, isError: failed }
    } catch (error) {
      if (error instanceof InvalidParams) throw error
      return { content: [text({ error: error instanceof Error ? error.message : String(error) })], isError: true }
    }
  }

  private resourceList(session: McpSession) {
    const resources: Array<{ uri: string; name: string; mimeType: string; description?: string }> = []
    const ids = session.projectId ? [session.projectId] : this.context.store.list().map((project) => project.id)
    ids.forEach((id) => {
      const project = this.context.readProject(id)
      resources.push({ uri: `project://${id}`, name: `${project.name} (portable JSON)`, mimeType: 'application/json' })
      resources.push({ uri: `project://${id}/findings`, name: `${project.name} findings`, mimeType: 'application/json', description: `Integrity errors and ${project.settings.checkProfile} check findings` })
      Object.values(project.views).forEach((view) => resources.push({ uri: `project://${id}/diagram/${view.id}`, name: `${project.name}: ${view.useCase || view.name || view.kind}`, mimeType: 'image/svg+xml' }))
      Object.values(project.elements).filter(isErdStore).forEach((store) => resources.push({ uri: `project://${id}/ddl/${store.id}`, name: `${project.name}: ${store.name} DDL`, mimeType: 'application/sql' }))
    })
    return resources
  }

  private readResource(uri: string) {
    const match = uri.match(/^project:\/\/([^/]+)(?:\/(findings|diagram|ddl)(?:\/(.+))?)?$/)
    if (!match) throw new InvalidParams(`Unknown resource ${uri}`)
    const [, projectId, kind, target] = match
    const project = this.context.readProject(decodeURIComponent(projectId))
    if (!kind) return { contents: [{ uri, mimeType: 'application/json', text: serializeProject(project) }] }
    if (kind === 'findings') return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(allFindings(project), null, 2) }] }
    if (kind === 'ddl') {
      const result = buildDdl(project, decodeURIComponent(target ?? ''))
      if (!result.sql) throw new InvalidParams(`${target} is not a database or schema container`)
      return { contents: [{ uri, mimeType: 'application/sql', text: result.sql }] }
    }
    const view = project.views[decodeURIComponent(target ?? '')]
    if (!view) throw new InvalidParams(`No view ${target}`)
    const copy = COPY.en
    const model = buildRenderModel(project, view, THEMES[project.settings.styleTheme] ?? THEMES.compact, renderLabels(copy, project, view, project.name))
    return { contents: [{ uri, mimeType: 'image/svg+xml', text: renderSvg(model, { frame: 'inline', background: true }) }] }
  }
}

class MethodNotFound extends Error {}
class InvalidParams extends Error {}

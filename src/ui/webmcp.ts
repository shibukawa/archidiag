import type { Element, Project, Relationship, ViewKind } from '../core/model'
import type { Finding } from '../core/validate'

export interface ToolHost {
  getProject: () => Project
  getCurrentViewId: () => string
  listViews: () => Array<{ id: string; kind: ViewKind; scopeId: string | null; name: string; isDefault: boolean }>
  openView: (viewId: string) => boolean
  openScope: (kind: ViewKind, scopeId: string | null) => string | undefined
  createElement: (input: { name: string; kind: Element['kind']; parentId?: string; description?: string; technology?: string; containerCategory?: Element['containerCategory']; applicationKind?: Element['applicationKind']; dataStoreKind?: Element['dataStoreKind'] }) => Element | { error: string }
  updateElement: (id: string, patch: Partial<Element>) => Element | { error: string }
  deleteElements: (ids: string[]) => string[]
  createRelationship: (input: { sourceId: string; targetId: string; label: string; technology?: string }) => Relationship | { error: string }
  updateRelationship: (id: string, patch: Partial<Relationship>) => Relationship | { error: string }
  deleteRelationship: (id: string) => boolean
  arrangeView: (viewId?: string) => boolean
  findings: () => Finding[]
}

interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: unknown
  execute: (input: Record<string, unknown>) => unknown
}

type ModelContext = { registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => Promise<void> | void }

function log(tool: string, action: string, payload: Record<string, unknown>) {
  console.log('[WebMCP edit]', { timestamp: new Date().toISOString(), source: 'WebMCP', tool, action, ...payload })
}

/** Registers the C4 tool surface on document.modelContext when the browser provides it. Edits apply directly. */
export function registerWebMcpTools(host: ToolHost, onReady: (ready: boolean) => void): () => void {
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext
  if (!modelContext) { onReady(false); return () => {} }
  const controller = new AbortController()
  const str = { type: 'string' }
  const tools: ToolDefinition[] = [
    { name: 'get_project_summary', title: 'Get project summary', description: 'Project name, current view, and counts.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: () => { const project = host.getProject(); return { project: project.name, currentViewId: host.getCurrentViewId(), elements: Object.keys(project.elements).length, relationships: Object.keys(project.relationships).length, views: Object.keys(project.views).length } } },
    { name: 'list_views', title: 'List views', description: 'Every diagram view with kind, scope, and default flag.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: () => host.listViews() },
    { name: 'get_view', title: 'Get view', description: 'Elements and relationships of one view, or the current view.', inputSchema: { type: 'object', properties: { viewId: str }, additionalProperties: false },
      execute: (input) => { const project = host.getProject(); const view = project.views[String(input.viewId ?? host.getCurrentViewId())]; if (!view) return { error: 'Unknown view' }; const scoped = Object.values(project.elements).filter((element) => (element.parentId ?? null) === view.scopeId && (!view.elementRefs.length || view.elementRefs.includes(element.id))); return { view: { id: view.id, kind: view.kind, scopeId: view.scopeId, name: view.name }, elements: scoped, relationships: Object.values(project.relationships).filter((relationship) => scoped.some((element) => element.id === relationship.sourceId || element.id === relationship.targetId)) } } },
    { name: 'list_elements', title: 'List elements', description: 'Every canonical element.', inputSchema: { type: 'object', properties: { kind: str }, additionalProperties: false }, execute: (input) => Object.values(host.getProject().elements).filter((element) => !input.kind || element.kind === input.kind) },
    { name: 'open_view', title: 'Open view', description: 'Show a view in the editor.', inputSchema: { type: 'object', properties: { viewId: str }, required: ['viewId'], additionalProperties: false }, execute: (input) => ({ ok: host.openView(String(input.viewId)) }) },
    { name: 'enter_scope', title: 'Enter scope', description: 'Open the default child view of a software system or application container.', inputSchema: { type: 'object', properties: { elementId: str }, required: ['elementId'], additionalProperties: false },
      execute: (input) => { const element = host.getProject().elements[String(input.elementId)]; if (!element) return { error: 'Unknown element' }; const kind: ViewKind | undefined = element.kind === 'softwareSystem' ? 'c4_container' : element.kind === 'container' ? 'c4_component' : undefined; if (!kind) return { error: 'Element has no child scope' }; const viewId = host.openScope(kind, element.id); return viewId ? { ok: true, viewId } : { error: 'Could not open scope' } } },
    { name: 'validate_project', title: 'Validate project', description: 'Integrity errors and check findings for the active profile.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: () => host.findings() },
    { name: 'create_element', title: 'Create element', description: 'Create a canonical element; containers need a software system parent, components an application container parent.', inputSchema: { type: 'object', properties: { name: str, kind: { type: 'string', enum: ['person', 'softwareSystem', 'externalSystem', 'container', 'component'] }, parentId: str, description: str, technology: str, containerCategory: { type: 'string', enum: ['application', 'dataStore'] }, applicationKind: { type: 'string', enum: ['webBrowser', 'mobileApp', 'desktopApp', 'server', 'worker', 'other'] }, dataStoreKind: { type: 'string', enum: ['database', 'databaseSchema', 'pubSub', 'queue', 'bucket', 'cache', 'fileShare', 'other'] } }, required: ['name', 'kind'], additionalProperties: false },
      execute: (input) => { const result = host.createElement(input as never); if (!('error' in result)) log('create_element', 'create', { elementId: result.id, elementKind: result.kind, changes: input }); return result } },
    { name: 'rename_element', title: 'Rename element', description: 'Rename one canonical element; every view resolves the new name.', inputSchema: { type: 'object', properties: { elementId: str, name: str }, required: ['elementId', 'name'], additionalProperties: false },
      execute: (input) => { const before = host.getProject().elements[String(input.elementId)]; const result = host.updateElement(String(input.elementId), { name: String(input.name) }); if (!('error' in result)) log('rename_element', 'rename', { elementId: result.id, elementKind: result.kind, changes: { name: { from: before?.name, to: result.name } } }); return result } },
    { name: 'update_element', title: 'Update element', description: 'Patch description, technology, or container taxonomy.', inputSchema: { type: 'object', properties: { elementId: str, description: str, technology: str, containerCategory: str, dataStoreKind: str, sqlDialect: str }, required: ['elementId'], additionalProperties: false },
      execute: (input) => { const { elementId, ...patch } = input; const result = host.updateElement(String(elementId), patch as Partial<Element>); if (!('error' in result)) log('update_element', 'update', { elementId: result.id, elementKind: result.kind, changes: patch }); return result } },
    { name: 'delete_element', title: 'Delete element', description: 'Delete an element and its descendants.', inputSchema: { type: 'object', properties: { elementId: str }, required: ['elementId'], additionalProperties: false },
      execute: (input) => { const ids = host.deleteElements([String(input.elementId)]); log('delete_element', 'delete', { elementId: input.elementId, changes: { deleted: ids } }); return { deleted: ids } } },
    { name: 'create_relationship', title: 'Create relationship', description: 'Connect two canonical elements.', inputSchema: { type: 'object', properties: { sourceId: str, targetId: str, label: str, technology: str }, required: ['sourceId', 'targetId', 'label'], additionalProperties: false },
      execute: (input) => { const result = host.createRelationship(input as never); if (!('error' in result)) log('create_relationship', 'create', { relationshipId: result.id, changes: input }); return result } },
    { name: 'update_relationship', title: 'Update relationship', description: 'Patch label or technology.', inputSchema: { type: 'object', properties: { relationshipId: str, label: str, technology: str, description: str }, required: ['relationshipId'], additionalProperties: false },
      execute: (input) => { const { relationshipId, ...patch } = input; const result = host.updateRelationship(String(relationshipId), patch as Partial<Relationship>); if (!('error' in result)) log('update_relationship', 'update', { relationshipId, changes: patch }); return result } },
    { name: 'delete_relationship', title: 'Delete relationship', description: 'Delete one relationship.', inputSchema: { type: 'object', properties: { relationshipId: str }, required: ['relationshipId'], additionalProperties: false },
      execute: (input) => { const ok = host.deleteRelationship(String(input.relationshipId)); if (ok) log('delete_relationship', 'delete', { relationshipId: input.relationshipId, changes: {} }); return { ok } } },
    { name: 'arrange_view', title: 'Arrange view', description: 'Run the automatic left-to-right layout on a view.', inputSchema: { type: 'object', properties: { viewId: str }, additionalProperties: false }, execute: (input) => ({ ok: host.arrangeView(input.viewId ? String(input.viewId) : undefined) }) },
  ]
  Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).then(() => onReady(true)).catch(() => onReady(false))
  return () => controller.abort()
}

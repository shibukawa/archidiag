// The AI tool surface (api:ai-tool-surface), defined once for the in-browser WebMCP and the server's MCP endpoint
// (decision:shared-typescript-core). Tools run through the same pure commands as the editor; no DOM here.
import { arrangeView } from './arrange'
import * as commands from './commands'
import { connectionVerdict, dfdOf, dfdViews, importableLinks } from './dfd'
import { childViewKind, defaultErdRelationship, estimateVolume, isDfdView, isErdStore, itemKindFor, type Attribute, type CodeSet, type Consistency, type CrudOperation, type DataDomain, type DfdBoundary, type DfdFlow, type DfdGroup, type DfdNode, type DfdRole, type DiagramView, type DomainComponent, type Element, type EntityVolume, type ErdRelationship, type IntermediateKind, type Project, type Relationship, type SqlDialect, type TypeSpec, type ViewKind, type VocabularyEntry } from './model'
import { allFindings, type Finding } from './validate'
import { ensureDefaultView } from './views'
import { assignDomain, createCategory, createDictionaryDomain, deleteDomain, domainTypeLabel, domainUsage, isDefined, makeCodeSetEntry, makeComponent, mergeCandidates, mergeConflicts, mergeDomains, patchDomain } from './domains'
import { addEntry, bindName, conflictingEntry, deleteEntry, patchEntry, renameEntry, vocabularyUsage } from './vocabulary'
import { buildDdl } from './ddl'
import { localSuggestions } from './suggest'

export interface ToolHost {
  getProject: () => Project
  /** The editor's open view; absent without a browser. */
  getCurrentViewId?: () => string
  listViews: () => Array<{ id: string; kind: ViewKind; scopeId: string | null; name: string; isDefault: boolean }>
  /** Shows a view in the editor; absent without a browser. */
  openView?: (viewId: string) => boolean
  openScope: (kind: ViewKind, scopeId: string | null) => string | undefined
  createElement: (input: { name: string; kind: Element['kind']; parentId?: string; description?: string; technology?: string; containerCategory?: Element['containerCategory']; applicationKind?: Element['applicationKind']; dataStoreKind?: Element['dataStoreKind']; classification?: Element['classification']; storageKind?: Element['storageKind']; passthrough?: boolean }) => Element | { error: string }
  updateElement: (id: string, patch: Partial<Element>) => Element | { error: string }
  deleteElements: (ids: string[]) => string[]
  createRelationship: (input: { sourceId: string; targetId: string; label: string; technology?: string; erd?: Partial<ErdRelationship> }) => Relationship | { error: string }
  addAttribute: (entityId: string, name: string, patch: Partial<Attribute>) => Attribute | { error: string }
  updateAttribute: (entityId: string, attributeId: string, patch: Partial<Attribute>) => Attribute | { error: string }
  deleteAttribute: (entityId: string, attributeId: string) => boolean
  updateRelationship: (id: string, patch: Partial<Relationship>) => Relationship | { error: string }
  deleteRelationship: (id: string) => boolean
  arrangeView: (viewId?: string) => boolean
  findings: () => Finding[]
  createDfd: (input: { scopeId?: string; useCase: string }) => DiagramView | { error: string }
  addDfdNode: (input: { viewId: string; elementId?: string; role?: DfdRole; name?: string; description?: string; intermediateKind?: IntermediateKind }) => DfdNode | { error: string }
  createDfdFlow: (input: { viewId: string; sourceNodeId: string; targetNodeId: string; label?: string; technology?: string; dataRefs?: string[]; operations?: CrudOperation[] }) => DfdFlow | { error: string }
  createBoundary: (input: { viewId: string; name: string; flowIds: string[]; consistency?: Consistency }) => DfdBoundary | { error: string }
  placeDfdNode: (input: { viewId: string; nodeId: string; kind: Element['kind']; parentId?: string }) => Element | { error: string }
  importLinks: (input: { viewId: string }) => { imported: number }
  linkProcesses: (input: { viewId: string; sourceNodeId: string; targetNodeId: string; kind?: IntermediateKind; name?: string }) => { node: DfdNode; group?: DfdGroup } | { error: string }
  /** Applies a pure project command as one undoable edit and returns its result. */
  mutate: <T>(apply: (project: Project) => { project: Project; result: T }) => T
  /** Records an accepted edit (requirement:webmcp-edit-logging). */
  log: (tool: string, action: string, payload: Record<string, unknown>) => void
}

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: unknown
  execute: (input: Record<string, unknown>) => unknown
}

/** Tools that never change the project: allowed for read_only participants and annotated for MCP clients. */
export const READ_ONLY_TOOLS = new Set(['get_project_summary', 'list_views', 'get_view', 'list_elements', 'open_view', 'validate_project', 'list_attributes', 'list_dfds', 'list_vocabulary', 'resolve_name', 'suggest_names', 'list_domains', 'list_merge_candidates', 'export_ddl'])

export interface ToolContext {
  getProject: () => Project
  /** Applies one edit; the host decides history, attribution, and broadcast. */
  apply: (update: (project: Project) => Project) => void
  log: ToolHost['log']
}

/**
 * The tool host every entry point shares: validation and commands on the current project, edits through
 * context.apply. A browser overrides the view methods to move the editor.
 */
export function createToolHost(context: ToolContext): ToolHost {
  const { getProject, apply } = context
  const mutate = <T,>(run: (project: Project) => { project: Project; result: T }): T => {
    let result!: T
    apply((project) => { const out = run(project); result = out.result; return out.project })
    return result
  }
  const commit = (next: Project) => apply(() => next)
  return {
    getProject,
    listViews: () => Object.values(getProject().views).map(({ id, kind, scopeId, name, isDefault }) => ({ id, kind, scopeId, name, isDefault })),
    openScope: (kind, scopeId) => mutate((project) => { const ensured = ensureDefaultView(project, kind, scopeId); const withLayout = Object.keys(ensured.view.layout.positions).length || ensured.project === project ? ensured.project : (() => { const arranged = arrangeView(ensured.project, ensured.view); return commands.setPositions(ensured.project, ensured.view.id, arranged.positions, arranged.boundary) })(); return { project: withLayout, result: ensured.view.id } }),
    createElement: (input) => {
      const current = getProject()
      const parent = input.parentId ? current.elements[input.parentId] : undefined
      if (input.kind === 'container' && parent?.kind !== 'softwareSystem') return { error: 'Containers need a software system parent' }
      if (input.kind === 'component' && parent?.kind !== 'container') return { error: 'Components need an application container parent' }
      if (input.kind === 'entity' && !isErdStore(parent) && parent?.kind !== 'entity') return { error: 'Entities need a database or database schema container parent, or an owner entity for a dependent table' }
      if ((input.kind === 'topic' || input.kind === 'folder') && itemKindFor(parent) !== input.kind) return { error: input.kind === 'topic' ? 'Topics need a pub/sub or queue container parent' : 'Folders need a bucket or file share container parent' }
      if (['person', 'softwareSystem', 'externalSystem'].includes(input.kind) && input.parentId) return { error: `${input.kind} cannot have a parent` }
      const created = input.kind === 'entity'
        ? commands.createEntity(current, { name: input.name, description: input.description ?? '', technology: input.technology ?? '', parentId: input.parentId, classification: input.classification, storageKind: input.storageKind })
        : commands.createElement(current, { kind: input.kind, name: input.name, description: input.description ?? '', technology: input.technology ?? '', parentId: input.parentId, containerCategory: input.containerCategory, applicationKind: input.applicationKind, dataStoreKind: input.dataStoreKind, passthrough: input.passthrough })
      commit(created.project)
      return created.element
    },
    updateElement: (id, patch) => {
      if (!getProject().elements[id]) return { error: 'Unknown element' }
      apply((project) => commands.pruneEmptyPlaceholders(commands.patchElement(project, id, patch)))
      return getProject().elements[id]
    },
    deleteElements: (ids) => {
      const result = commands.deleteElements(getProject(), ids.filter((id) => getProject().elements[id]))
      if (result.deletedIds.length) commit(commands.pruneEmptyPlaceholders(result.project))
      return result.deletedIds
    },
    createRelationship: (input) => {
      const current = getProject()
      if (!current.elements[input.sourceId] || !current.elements[input.targetId]) return { error: 'Unknown endpoint' }
      if (input.sourceId === input.targetId) return { error: 'A relationship needs two different elements' }
      const erd = current.elements[input.sourceId].kind === 'entity' && current.elements[input.targetId].kind === 'entity' ? { ...defaultErdRelationship(), ...input.erd } : undefined
      const { erd: _requested, ...rest } = input
      const created = commands.createRelationship(current, { ...rest, ...(erd ? { erd } : {}) })
      commit(created.project)
      return created.relationship
    },
    addAttribute: (entityId, name, patch) => {
      if (getProject().elements[entityId]?.kind !== 'entity') return { error: 'Unknown entity' }
      const result = commands.addAttribute(getProject(), entityId, name, patch)
      commit(result.project)
      return getProject().elements[entityId]?.attributes?.find((attribute) => attribute.id === result.attribute.id) ?? result.attribute
    },
    updateAttribute: (entityId, attributeId, patch) => {
      if (!getProject().elements[entityId]?.attributes?.some((item) => item.id === attributeId)) return { error: 'Unknown attribute' }
      apply((project) => commands.patchAttribute(project, entityId, attributeId, patch))
      return getProject().elements[entityId]!.attributes!.find((item) => item.id === attributeId)!
    },
    deleteAttribute: (entityId, attributeId) => {
      if (!getProject().elements[entityId]?.attributes?.some((item) => item.id === attributeId)) return false
      apply((project) => commands.deleteAttribute(project, entityId, attributeId))
      return true
    },
    updateRelationship: (id, patch) => {
      if (!getProject().relationships[id]) return { error: 'Unknown relationship' }
      apply((project) => commands.patchRelationship(project, id, patch))
      return getProject().relationships[id]
    },
    deleteRelationship: (id) => {
      if (!getProject().relationships[id]) return false
      apply((project) => commands.deleteRelationship(project, id))
      return true
    },
    arrangeView: (viewId) => {
      const current = getProject()
      const target = viewId ? current.views[viewId] : undefined
      if (!target) return false
      const arranged = arrangeView(current, target)
      apply((project) => commands.setPositions(project, target.id, arranged.positions, arranged.boundary))
      return true
    },
    findings: () => allFindings(getProject()),
    createDfd: (input) => {
      const current = getProject()
      if (!input.scopeId || current.elements[input.scopeId]?.kind !== 'softwareSystem') return { error: 'scopeId must be a software system: DFDs live at container level' }
      const created = commands.createDfd(current, 'dfd_container', input.scopeId, input.useCase)
      commit(created.project)
      return created.view
    },
    addDfdNode: (input) => {
      const current = getProject()
      if (!isDfdView(current.views[input.viewId]?.kind ?? 'c4_context')) return { error: 'Unknown DFD' }
      const added = input.elementId ? commands.addBoundNode(current, input.viewId, input.elementId) : input.role && input.name ? commands.addFreeNode(current, input.viewId, { role: input.role, name: input.name, description: input.description, intermediateKind: input.intermediateKind }) : { project: current, node: undefined }
      if (!added.node) return { error: 'Provide elementId, or role and name' }
      commit(added.project)
      return added.node
    },
    createDfdFlow: (input) => {
      const current = getProject()
      const view = current.views[input.viewId]
      if (!view || !isDfdView(view.kind)) return { error: 'Unknown DFD' }
      const payload = dfdOf(view)
      const source = payload.nodes[input.sourceNodeId]
      const target = payload.nodes[input.targetNodeId]
      if (!source || !target) return { error: 'Unknown node' }
      if (connectionVerdict(source, target).kind !== 'allowed') return { error: 'Flows join a process with data or an external entity; insert intermediate data or a process between two of a kind' }
      const created = commands.createFlow(current, input.viewId, input)
      if (!created.flow) return { error: 'Could not create flow' }
      commit(created.project)
      return created.flow
    },
    createBoundary: (input) => {
      const created = commands.createBoundary(getProject(), input.viewId, input.name, input.flowIds, input.consistency)
      if (!created.boundary) return { error: 'Unknown DFD' }
      commit(created.project)
      return created.boundary
    },
    placeDfdNode: (input) => {
      const result = commands.placeNode(getProject(), input.viewId, input.nodeId, { id: 'mcp', kind: input.kind, parentId: input.parentId, patch: {} })
      if (!result.element) return { error: 'Node is missing or already bound' }
      commit(result.project)
      return result.element
    },
    importLinks: (input) => {
      let next = getProject()
      let imported = 0
      for (let guard = 0; guard < 100; guard += 1) {
        const view = next.views[input.viewId]
        if (!view) break
        const link = importableLinks(next, view)[0]
        if (!link) break
        const result = commands.importLink(next, input.viewId, link)
        if (!result.node) break
        next = result.project
        imported += 1
      }
      if (imported) commit(next)
      return { imported }
    },
    linkProcesses: (input) => {
      const current = getProject()
      const view = current.views[input.viewId]
      const payload = view && isDfdView(view.kind) ? dfdOf(view) : undefined
      if (payload?.nodes[input.sourceNodeId]?.role !== 'process' || payload?.nodes[input.targetNodeId]?.role !== 'process') return { error: 'Both endpoints must be process nodes of the DFD' }
      const linked = commands.linkProcesses(current, input.viewId, input.sourceNodeId, input.targetNodeId, input.kind ?? 'api_document', input.name ?? (input.kind === 'file' ? 'File' : input.kind === 'queue' ? 'Event' : 'Request'))
      if (!linked.node) return { error: 'Could not link' }
      commit(linked.project)
      return { node: linked.node, group: linked.group }
    },
    mutate,
    log: context.log,
  }
}

/** Every tool of the surface, bound to a host. */
export function toolDefinitions(host: ToolHost): ToolDefinition[] {
  const str = { type: 'string' }
  return [
    { name: 'get_project_summary', title: 'Get project summary', description: 'Project name, current view, and counts.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: () => { const project = host.getProject(); return { project: project.name, currentViewId: host.getCurrentViewId?.() ?? null, elements: Object.keys(project.elements).length, relationships: Object.keys(project.relationships).length, views: Object.keys(project.views).length } } },
    { name: 'list_views', title: 'List views', description: 'Every diagram view with kind, scope, and default flag.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: () => host.listViews() },
    { name: 'get_view', title: 'Get view', description: 'Elements and relationships of one view, or the current view.', inputSchema: { type: 'object', properties: { viewId: str }, additionalProperties: false },
      execute: (input) => { const project = host.getProject(); const view = project.views[String(input.viewId ?? host.getCurrentViewId?.() ?? '')]; if (!view) return { error: 'Unknown view' }; const scoped = Object.values(project.elements).filter((element) => (element.parentId ?? null) === view.scopeId && (!view.elementRefs.length || view.elementRefs.includes(element.id))); return { view: { id: view.id, kind: view.kind, scopeId: view.scopeId, name: view.name }, elements: scoped, relationships: Object.values(project.relationships).filter((relationship) => scoped.some((element) => element.id === relationship.sourceId || element.id === relationship.targetId)) } } },
    { name: 'list_elements', title: 'List elements', description: 'Every canonical element.', inputSchema: { type: 'object', properties: { kind: str }, additionalProperties: false }, execute: (input) => Object.values(host.getProject().elements).filter((element) => !input.kind || element.kind === input.kind) },
    { name: 'open_view', title: 'Open view', description: 'Show a view in the editor.', inputSchema: { type: 'object', properties: { viewId: str }, required: ['viewId'], additionalProperties: false }, execute: (input) => (host.openView ? { ok: host.openView(String(input.viewId)) } : { error: 'No editor is attached; open the view in a browser' }) },
    { name: 'enter_scope', title: 'Enter scope', description: 'Open the default child view of a software system, application container, or database container (its ERD).', inputSchema: { type: 'object', properties: { elementId: str }, required: ['elementId'], additionalProperties: false },
      execute: (input) => { const element = host.getProject().elements[String(input.elementId)]; if (!element) return { error: 'Unknown element' }; const kind: ViewKind | undefined = childViewKind(element); if (!kind) return { error: 'Element has no child scope' }; const viewId = host.openScope(kind, element.id); return viewId ? { ok: true, viewId } : { error: 'Could not open scope' } } },
    { name: 'validate_project', title: 'Validate project', description: 'Integrity errors and check findings for the active profile.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: () => host.findings() },
    { name: 'create_element', title: 'Create element', description: 'Create a canonical element; containers need a software system parent, components an application container parent, entities (tables) a database container parent, or an owner entity to create a dependent table (the dependent relationship is created too). A new entity gets a surrogate primary key.', inputSchema: { type: 'object', properties: { name: str, kind: { type: 'string', enum: ['person', 'softwareSystem', 'externalSystem', 'container', 'component', 'entity', 'topic', 'folder'] }, parentId: str, description: str, technology: str, passthrough: { type: 'boolean' }, containerCategory: { type: 'string', enum: ['application', 'dataStore'] }, applicationKind: { type: 'string', enum: ['webBrowser', 'mobileApp', 'desktopApp', 'server', 'worker', 'other'] }, dataStoreKind: { type: 'string', enum: ['database', 'databaseSchema', 'pubSub', 'queue', 'bucket', 'cache', 'fileShare', 'other'] }, classification: { type: 'string', enum: ['resource', 'event', 'summary', 'work', 'code'] }, storageKind: { type: 'string', enum: ['table', 'view', 'materialized_view'] } }, required: ['name', 'kind'], additionalProperties: false },
      execute: (input) => { const result = host.createElement(input as never); if (!('error' in result)) host.log('create_element', 'create', { elementId: result.id, elementKind: result.kind, changes: input }); return result } },
    { name: 'rename_element', title: 'Rename element', description: 'Rename one canonical element; every view resolves the new name.', inputSchema: { type: 'object', properties: { elementId: str, name: str }, required: ['elementId', 'name'], additionalProperties: false },
      execute: (input) => { const before = host.getProject().elements[String(input.elementId)]; const result = host.updateElement(String(input.elementId), { name: String(input.name) }); if (!('error' in result)) host.log('rename_element', 'rename', { elementId: result.id, elementKind: result.kind, changes: { name: { from: before?.name, to: result.name } } }); return result } },
    { name: 'update_element', title: 'Update element', description: 'Patch description, technology, container taxonomy, entity classification, or entity storage kind (table, view, materialized_view).', inputSchema: { type: 'object', properties: { elementId: str, description: str, technology: str, containerCategory: str, dataStoreKind: str, sqlDialect: str, classification: str, storageKind: str }, required: ['elementId'], additionalProperties: false },
      execute: (input) => { const { elementId, ...patch } = input; const result = host.updateElement(String(elementId), patch as Partial<Element>); if (!('error' in result)) host.log('update_element', 'update', { elementId: result.id, elementKind: result.kind, changes: patch }); return result } },
    { name: 'delete_element', title: 'Delete element', description: 'Delete an element and its descendants.', inputSchema: { type: 'object', properties: { elementId: str }, required: ['elementId'], additionalProperties: false },
      execute: (input) => { const ids = host.deleteElements([String(input.elementId)]); host.log('delete_element', 'delete', { elementId: input.elementId, changes: { deleted: ids } }); return { deleted: ids } } },
    { name: 'create_relationship', title: 'Create relationship', description: 'Connect two canonical elements. Between two entities of one data store the line is an ERD relationship: kind reference (source is the many side holding the key), inherit, or label, with UML multiplicity at each end.', inputSchema: { type: 'object', properties: { sourceId: str, targetId: str, label: str, technology: str, erd: { type: 'object', properties: { kind: { type: 'string', enum: ['reference', 'dependent', 'inherit', 'label'] }, sourceCardinality: { type: 'string', enum: ['1', '0..1', '*', '1..*'] }, targetCardinality: { type: 'string', enum: ['1', '0..1', '*', '1..*'] }, important: { type: 'boolean' } }, additionalProperties: false } }, required: ['sourceId', 'targetId', 'label'], additionalProperties: false },
      execute: (input) => { const result = host.createRelationship(input as never); if (!('error' in result)) host.log('create_relationship', 'create', { relationshipId: result.id, changes: input }); return result } },
    { name: 'update_relationship', title: 'Update relationship', description: 'Patch label, technology, description, or the ERD kind and multiplicity.', inputSchema: { type: 'object', properties: { relationshipId: str, label: str, technology: str, description: str, erd: { type: 'object', properties: { kind: { type: 'string', enum: ['reference', 'dependent', 'inherit', 'label'] }, sourceCardinality: str, targetCardinality: str, important: { type: 'boolean' } }, additionalProperties: false } }, required: ['relationshipId'], additionalProperties: false },
      execute: (input) => { const { relationshipId, ...patch } = input; const result = host.updateRelationship(String(relationshipId), patch as Partial<Relationship>); if (!('error' in result)) host.log('update_relationship', 'update', { relationshipId, changes: patch }); return result } },
    { name: 'delete_relationship', title: 'Delete relationship', description: 'Delete one relationship.', inputSchema: { type: 'object', properties: { relationshipId: str }, required: ['relationshipId'], additionalProperties: false },
      execute: (input) => { const ok = host.deleteRelationship(String(input.relationshipId)); if (ok) host.log('delete_relationship', 'delete', { relationshipId: input.relationshipId, changes: {} }); return { ok } } },
    { name: 'list_attributes', title: 'List attributes', description: 'Every field of one entity with its flags; only important fields draw on the ERD card.', inputSchema: { type: 'object', properties: { entityId: str }, required: ['entityId'], additionalProperties: false },
      execute: (input) => { const element = host.getProject().elements[String(input.entityId)]; if (element?.kind !== 'entity') return { error: 'Unknown entity' }; return element.attributes ?? [] } },
    { name: 'add_attribute', title: 'Add attribute', description: 'Add a field to an entity. Set important to show it on the ERD card; a primary key is important by default.', inputSchema: { type: 'object', properties: { entityId: str, name: str, description: str, important: { type: 'boolean' }, primaryKey: { type: 'boolean' }, required: { type: 'boolean' }, unique: { type: 'boolean' } }, required: ['entityId', 'name'], additionalProperties: false },
      execute: (input) => { const { entityId, name, ...patch } = input; const flags = patch as Partial<Attribute>; const result = host.addAttribute(String(entityId), String(name), { ...flags, ...(flags.primaryKey ? { important: flags.important ?? true } : {}) }); if (!('error' in result)) host.log('add_attribute', 'create', { elementId: entityId, attributeId: result.id, changes: input }); return result } },
    { name: 'update_attribute', title: 'Update attribute', description: 'Patch a field: name, description, important, primaryKey, required, unique.', inputSchema: { type: 'object', properties: { entityId: str, attributeId: str, name: str, description: str, important: { type: 'boolean' }, primaryKey: { type: 'boolean' }, required: { type: 'boolean' }, unique: { type: 'boolean' } }, required: ['entityId', 'attributeId'], additionalProperties: false },
      execute: (input) => { const { entityId, attributeId, ...patch } = input; const result = host.updateAttribute(String(entityId), String(attributeId), patch as Partial<Attribute>); if (!('error' in result)) host.log('update_attribute', 'update', { elementId: entityId, attributeId, changes: patch }); return result } },
    { name: 'delete_attribute', title: 'Delete attribute', description: 'Remove one field from an entity.', inputSchema: { type: 'object', properties: { entityId: str, attributeId: str }, required: ['entityId', 'attributeId'], additionalProperties: false },
      execute: (input) => { const ok = host.deleteAttribute(String(input.entityId), String(input.attributeId)); if (ok) host.log('delete_attribute', 'delete', { elementId: input.entityId, attributeId: input.attributeId, changes: {} }); return { ok } } },
    { name: 'set_entity_volume', title: 'Set entity volume', description: 'Record sizing assumptions on an entity: bytes per row, initial rows, rows added per period, refresh mode and frequency, retention months. Returns the estimate at the project horizon.', inputSchema: { type: 'object', properties: { entityId: str, recordBytes: { type: 'number' }, initialRows: { type: 'number' }, growthRows: { type: 'number' }, growthPeriod: { type: 'string', enum: ['day', 'week', 'month', 'year'] }, refreshMode: { type: 'string', enum: ['append', 'upsert', 'rebuild'] }, refreshEvery: { type: 'string', enum: ['hourly', 'daily', 'weekly', 'monthly', 'on_demand'] }, retentionMonths: { type: 'number' }, note: str }, required: ['entityId'], additionalProperties: false },
      execute: (input) => { const { entityId, ...volume } = input; const current = host.getProject().elements[String(entityId)]; if (current?.kind !== 'entity') return { error: 'Unknown entity' }; const merged = { ...current.volume, ...(volume as Partial<EntityVolume>) }; const result = host.updateElement(String(entityId), { volume: merged }); if ('error' in result) return result; host.log('set_entity_volume', 'update', { elementId: entityId, changes: volume }); return { volume: merged, estimate: estimateVolume(merged, host.getProject().settings.volumeHorizonMonths) } } },
    { name: 'arrange_view', title: 'Arrange view', description: 'Run the automatic left-to-right layout on a view.', inputSchema: { type: 'object', properties: { viewId: str }, additionalProperties: false }, execute: (input) => ({ ok: host.arrangeView(input.viewId ? String(input.viewId) : undefined) }) },
    { name: 'list_dfds', title: 'List DFDs', description: 'Every data flow diagram with kind, scope, use case, and its nodes, flows, and transaction boundaries.', inputSchema: { type: 'object', properties: { scopeId: str }, additionalProperties: false },
      execute: (input) => dfdViews(host.getProject(), input.scopeId === undefined ? undefined : String(input.scopeId) || null).map((view) => ({ id: view.id, kind: view.kind, scopeId: view.scopeId, useCase: view.useCase, name: view.name, ...dfdOf(view) })) },
    { name: 'create_dfd', title: 'Create DFD', description: 'Create a use-case DFD for a software system: its application containers are processes, data stores and tables are stores, people and other systems are external entities.', inputSchema: { type: 'object', properties: { scopeId: str, useCase: str }, required: ['scopeId', 'useCase'], additionalProperties: false },
      execute: (input) => { const result = host.createDfd(input as never); if (!('error' in result)) host.log('create_dfd', 'create', { viewId: result.id, changes: input }); return result } },
    { name: 'add_dfd_node', title: 'Add DFD node', description: 'Add a node to a DFD: pass elementId to project an existing element (its role derives from its position), or role and name for a free node that is placed into the model later.', inputSchema: { type: 'object', properties: { viewId: str, elementId: str, role: { type: 'string', enum: ['external_entity', 'process', 'data_store', 'intermediate_data'] }, name: str, description: str, intermediateKind: { type: 'string', enum: ['file', 'queue'] } }, required: ['viewId'], additionalProperties: false },
      execute: (input) => { const result = host.addDfdNode(input as never); if (!('error' in result)) host.log('add_dfd_node', 'create', { viewId: input.viewId, nodeId: result.id, changes: input }); return result } },
    { name: 'create_dfd_flow', title: 'Create DFD flow', description: 'Connect two DFD nodes. A flow joins a process with a data node or an external entity; operations (C, R, U, D) apply at a data store end; dataRefs are entity ids or free text.', inputSchema: { type: 'object', properties: { viewId: str, sourceNodeId: str, targetNodeId: str, label: str, technology: str, dataRefs: { type: 'array', items: str }, operations: { type: 'array', items: { type: 'string', enum: ['C', 'R', 'U', 'D'] } } }, required: ['viewId', 'sourceNodeId', 'targetNodeId'], additionalProperties: false },
      execute: (input) => { const result = host.createDfdFlow(input as never); if (!('error' in result)) host.log('create_dfd_flow', 'create', { viewId: input.viewId, flowId: result.id, changes: input }); return result } },
    { name: 'create_transaction_boundary', title: 'Create transaction boundary', description: 'Mark flows of one DFD that succeed or fail together as atomic or eventual.', inputSchema: { type: 'object', properties: { viewId: str, name: str, flowIds: { type: 'array', items: str }, consistency: { type: 'string', enum: ['atomic', 'eventual'] } }, required: ['viewId', 'name', 'flowIds'], additionalProperties: false },
      execute: (input) => { const result = host.createBoundary(input as never); if (!('error' in result)) host.log('create_transaction_boundary', 'create', { viewId: input.viewId, boundaryId: result.id, changes: input }); return result } },
    { name: 'link_dfd_processes', title: 'Link DFD processes', description: 'Join two processes into one logical process group and insert intermediate data between them: api_document (default), file, or queue.', inputSchema: { type: 'object', properties: { viewId: str, sourceNodeId: str, targetNodeId: str, kind: { type: 'string', enum: ['api_document', 'file', 'queue'] }, name: str }, required: ['viewId', 'sourceNodeId', 'targetNodeId'], additionalProperties: false },
      execute: (input) => { const result = host.linkProcesses(input as never); if (!('error' in result)) host.log('link_dfd_processes', 'create', { viewId: input.viewId, nodeId: result.node.id, groupId: result.group?.id, changes: input }); return result } },
    { name: 'import_c4_links', title: 'Import C4 links into DFD', description: 'Turn every stored 1:1 component relationship between nodes of the DFD into a process -> API document -> process hop.', inputSchema: { type: 'object', properties: { viewId: str }, required: ['viewId'], additionalProperties: false },
      execute: (input) => { const result = host.importLinks({ viewId: String(input.viewId) }); host.log('import_c4_links', 'create', { viewId: input.viewId, changes: result }); return result } },
    { name: 'place_dfd_node', title: 'Place DFD node', description: 'Create a model element from a free DFD node and bind the node to it: a container or component under parentId, a person or external system at the root, an entity in a database.', inputSchema: { type: 'object', properties: { viewId: str, nodeId: str, kind: { type: 'string', enum: ['person', 'softwareSystem', 'externalSystem', 'container', 'component', 'entity'] }, parentId: str }, required: ['viewId', 'nodeId', 'kind'], additionalProperties: false },
      execute: (input) => { const result = host.placeDfdNode(input as never); if (!('error' in result)) host.log('place_dfd_node', 'create', { viewId: input.viewId, nodeId: input.nodeId, elementId: result.id, changes: input }); return result } },
    ...dictionaryTools(host),
  ]
}

const typeSchema = { type: 'object', properties: { primitive: { type: 'string', enum: ['smallint', 'integer', 'bigint', 'numeric', 'real', 'double_precision', 'varchar', 'text', 'bytea', 'date', 'time', 'timestamp', 'timestamptz', 'boolean', 'uuid', 'jsonb'] }, length: { type: 'number' }, precision: { type: 'number' }, scale: { type: 'number' } }, required: ['primitive'], additionalProperties: false }

function describeDomain(project: Project, domain: DataDomain, count: number) {
  return { id: domain.id, name: domain.name, origin: domain.origin, curated: domain.curated, shape: domain.shape, type: domainTypeLabel(project, domain) || null, defined: isDefined(project, domain), category: domain.categoryId ? project.domainCategories[domain.categoryId]?.name : null, description: domain.description, fields: count }
}

/** Vocabulary and domain dictionary tools (requirement: vocabulary-dictionary, requirement: domain-consolidation). */
function dictionaryTools(host: ToolHost): ToolDefinition[] {
  const str = { type: 'string' }
  const empty = { type: 'object', properties: {}, additionalProperties: false }
  const entryFields = { businessName: str, systemName: str, physicalName: str, physicalNamePlural: str, meaning: str, notes: str, aliases: { type: 'array', items: str } }
  return [
    { name: 'list_vocabulary', title: 'List vocabulary', description: 'Every vocabulary entry with business, system, and physical names, aliases, and how many bound names (tables, fields, domains) and text mentions use it.', inputSchema: empty,
      execute: () => { const project = host.getProject(); const usage = vocabularyUsage(project); return Object.values(project.vocabulary).map((entry) => ({ ...entry, bindings: usage.get(entry.id)?.bindings.length ?? 0, mentions: usage.get(entry.id)?.mentions.length ?? 0 })) } },
    { name: 'resolve_name', title: 'Resolve name', description: 'Match a name against the vocabulary (longest term first, separators and case ignored) and return its segments, derived business, system, and physical names, and indicators.', inputSchema: { type: 'object', properties: { name: str, plural: { type: 'boolean' } }, required: ['name'], additionalProperties: false },
      execute: (input) => { const binding = bindName(host.getProject(), String(input.name), Boolean(input.plural)); return { segments: binding.segments, business: binding.business, system: binding.system, physical: binding.physical ?? null, unmatched: binding.unmatched, indicators: binding.indicators } } },
    { name: 'add_vocabulary_entry', title: 'Add vocabulary entry', description: 'Register a term with its business name; system and physical names may follow later.', inputSchema: { type: 'object', properties: entryFields, required: ['businessName'], additionalProperties: false },
      execute: (input) => { const { businessName, ...patch } = input as Partial<VocabularyEntry> & { businessName: string }; const entry = host.mutate((project) => { const result = addEntry(project, businessName, patch); return { project: result.project, result: result.entry } }); host.log('add_vocabulary_entry', 'create', { entryId: entry.id, changes: input }); return entry } },
    { name: 'update_vocabulary_entry', title: 'Update vocabulary entry', description: 'Patch an entry. A new businessName rewrites every table, field, and domain name that used the old one.', inputSchema: { type: 'object', properties: { entryId: str, ...entryFields, policyException: { type: 'boolean' } }, required: ['entryId'], additionalProperties: false },
      execute: (input) => { const { entryId, businessName, ...patch } = input as Partial<VocabularyEntry> & { entryId: string }; if (!host.getProject().vocabulary[entryId]) return { error: 'Unknown entry' }; const clash = businessName ? conflictingEntry(host.getProject(), entryId, businessName) : undefined; if (clash) return { error: `"${businessName}" is already a term of ${clash.businessName}` }; const entry = host.mutate((project) => { let next = patchEntry(project, entryId, patch); if (businessName) next = renameEntry(next, entryId, businessName); return { project: next, result: next.vocabulary[entryId] } }); host.log('update_vocabulary_entry', 'update', { entryId, changes: input }); return entry } },
    { name: 'delete_vocabulary_entry', title: 'Delete vocabulary entry', description: 'Remove an entry; names that used it become unregistered.', inputSchema: { type: 'object', properties: { entryId: str }, required: ['entryId'], additionalProperties: false },
      execute: (input) => { const id = String(input.entryId); if (!host.getProject().vocabulary[id]) return { error: 'Unknown entry' }; host.mutate((project) => ({ project: deleteEntry(project, id), result: true })); host.log('delete_vocabulary_entry', 'delete', { entryId: id, changes: {} }); return { ok: true } } },
    { name: 'suggest_names', title: 'Suggest names', description: 'Candidate system and physical names for entries missing them, composed from registered terms first, then the same words or romaji per the naming policy. Nothing is applied; apply chosen candidates with update_vocabulary_entry.', inputSchema: { type: 'object', properties: { entryIds: { type: 'array', items: str } }, additionalProperties: false },
      execute: (input) => { const project = host.getProject(); const ids = Array.isArray(input.entryIds) ? (input.entryIds as string[]) : Object.keys(project.vocabulary); return ids.map((id) => project.vocabulary[id]).filter(Boolean).flatMap((entry) => localSuggestions(project, entry)) } },
    { name: 'list_domains', title: 'List domains', description: 'Every data domain with origin (from_field or dictionary), curated flag, shape, type, category, and field count.', inputSchema: empty,
      execute: () => { const project = host.getProject(); const usage = domainUsage(project); return Object.values(project.domains).map((domain) => describeDomain(project, domain, usage.get(domain.id)?.length ?? 0)) } },
    { name: 'list_merge_candidates', title: 'List domain merge candidates', description: 'Groups of domains that look like one: same name ignoring case and separators, same business name, similar names, or same type.', inputSchema: empty,
      execute: () => { const project = host.getProject(); return mergeCandidates(project).map((candidate) => ({ reason: candidate.reason, domains: candidate.domainIds.map((id) => ({ id, name: project.domains[id]?.name })) })) } },
    { name: 'create_domain', title: 'Create domain', description: 'Pre-register a shared domain in the dictionary, optionally typed as a single field, with a category name.', inputSchema: { type: 'object', properties: { name: str, type: typeSchema, description: str, categoryName: str }, required: ['name'], additionalProperties: false },
      execute: (input) => { const domain = host.mutate((project) => { const created = createDictionaryDomain(project, String(input.name)); let next = created.project; let categoryId: string | undefined; if (input.categoryName) { const existing = Object.values(next.domainCategories).find((category) => category.name === input.categoryName); if (existing) categoryId = existing.id; else { const made = createCategory(next, String(input.categoryName)); next = made.project; categoryId = made.category.id } } const patch: Partial<DataDomain> = { ...(input.type ? { shape: 'single_field', type: input.type as TypeSpec } : {}), ...(input.description ? { description: String(input.description) } : {}), ...(categoryId ? { categoryId } : {}) }; if (Object.keys(patch).length) next = patchDomain(next, created.domain.id, patch); return { project: next, result: next.domains[created.domain.id] } }); host.log('create_domain', 'create', { domainId: domain.id, changes: input }); return domain } },
    { name: 'update_domain', title: 'Update domain', description: 'Define a domain: rename it, set its category or description, or its shape: single_field with type, multi_field with ordered components, code_set with a base type and entries. Editing marks the domain curated.', inputSchema: { type: 'object', properties: { domainId: str, name: str, description: str, categoryId: str, shape: { type: 'string', enum: ['unresolved', 'single_field', 'multi_field', 'code_set'] }, type: typeSchema, components: { type: 'array', items: { type: 'object', properties: { name: str, type: typeSchema, domainRef: str, required: { type: 'boolean' }, description: str }, required: ['name'], additionalProperties: false } }, codeSet: { type: 'object', properties: { base: typeSchema, entries: { type: 'array', items: { type: 'object', properties: { name: str, value: str, description: str }, required: ['value'], additionalProperties: false } } }, required: ['base'], additionalProperties: false } }, required: ['domainId'], additionalProperties: false },
      execute: (input) => { const { domainId, components, codeSet, ...rest } = input as Record<string, unknown> & { domainId: string }; if (!host.getProject().domains[domainId]) return { error: 'Unknown domain' }; const patch: Partial<DataDomain> = { ...(rest as Partial<DataDomain>) }; if (Array.isArray(components)) patch.components = (components as Array<Partial<DomainComponent> & { name: string }>).map((component) => ({ ...makeComponent(component.name), ...component })); if (codeSet) { const set = codeSet as { base: TypeSpec; entries?: Array<{ name?: string; value: string; description?: string }> }; patch.codeSet = { base: set.base, entries: (set.entries ?? []).map((entry) => ({ ...makeCodeSetEntry(entry.name ?? entry.value, entry.value), description: entry.description ?? '' })) } as CodeSet } const domain = host.mutate((project) => { const next = patchDomain(project, domainId, patch); return { project: next, result: next.domains[domainId] } }); host.log('update_domain', 'update', { domainId, changes: input }); return domain } },
    { name: 'assign_domain', title: 'Assign domain', description: 'Assign a domain to one field, overriding its automatic domain, which is removed when nothing else uses it.', inputSchema: { type: 'object', properties: { entityId: str, attributeId: str, domainId: str }, required: ['entityId', 'attributeId', 'domainId'], additionalProperties: false },
      execute: (input) => { const project = host.getProject(); if (!project.elements[String(input.entityId)]?.attributes?.some((attribute) => attribute.id === input.attributeId)) return { error: 'Unknown attribute' }; if (!project.domains[String(input.domainId)]) return { error: 'Unknown domain' }; host.mutate((current) => ({ project: assignDomain(current, String(input.entityId), String(input.attributeId), String(input.domainId)), result: true })); host.log('assign_domain', 'update', { elementId: input.entityId, attributeId: input.attributeId, changes: { domainId: input.domainId } }); return { ok: true } } },
    { name: 'merge_domains', title: 'Merge domains', description: 'Merge domains into a survivor in one undoable step: their fields move to the survivor, merged names become aliases of its vocabulary entry, and the survivor is curated. Returns what the survivor overrode.', inputSchema: { type: 'object', properties: { survivorId: str, domainIds: { type: 'array', items: str }, rename: str }, required: ['survivorId', 'domainIds'], additionalProperties: false },
      execute: (input) => { const survivorId = String(input.survivorId); const ids = (input.domainIds as string[]).filter((id) => id !== survivorId); const project = host.getProject(); if (!project.domains[survivorId] || !ids.length || ids.some((id) => !project.domains[id])) return { error: 'Unknown survivor or domain' }; const conflicts = mergeConflicts(project, survivorId, ids); const survivor = host.mutate((current) => { const result = mergeDomains(current, survivorId, ids, input.rename ? String(input.rename) : undefined); return { project: result.project, result: result.project.domains[survivorId] } }); host.log('merge_domains', 'merge', { domainId: survivorId, changes: { merged: ids, rename: input.rename, conflicts } }); return { survivor, dropped: conflicts } } },
    { name: 'export_ddl', title: 'Export SQL DDL', description: 'CREATE TABLE statements for one database or schema container in its dialect (or the given one), with domain types substituted inline and lossy conversions commented; issues list names not from the vocabulary, untyped domains, and lossy types.', inputSchema: { type: 'object', properties: { storeId: str, dialect: { type: 'string', enum: ['postgresql', 'sqlite', 'mysql'] } }, required: ['storeId'], additionalProperties: false },
      execute: (input) => { const project = host.getProject(); if (!project.elements[String(input.storeId)]) return { error: 'Unknown data store' }; const result = buildDdl(project, String(input.storeId), input.dialect as SqlDialect | undefined); return result.sql ? result : { error: 'Not a database or database schema container' } } },
    { name: 'delete_domain', title: 'Delete domain', description: 'Delete a domain that no field uses.', inputSchema: { type: 'object', properties: { domainId: str }, required: ['domainId'], additionalProperties: false },
      execute: (input) => { const id = String(input.domainId); const project = host.getProject(); if (!project.domains[id]) return { error: 'Unknown domain' }; if ((domainUsage(project).get(id)?.length ?? 0) > 0) return { error: 'Domain is still assigned to fields' }; host.mutate((current) => ({ project: deleteDomain(current, id), result: true })); host.log('delete_domain', 'delete', { domainId: id, changes: {} }); return { ok: true } } },
  ]
}

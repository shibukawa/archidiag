// DFD semantics: roles by position, connection policy, placement of free nodes, numbering. No DOM here.
import {
  ancestorIds,
  childrenOf,
  effectiveCategory,
  isDfdView,
  isErdStore,
  isItemStore,
  isJobComponent,
  isScreenComponent,
  storeOf,
  type CrudOperation,
  type DfdFlow,
  type DfdGroup,
  type DfdNode,
  type DfdPayload,
  type DfdRole,
  type DiagramView,
  type Element,
  type ElementKind,
  type IntermediateKind,
  type Project,
  type Relationship,
  type ViewKind,
  itemKindFor,
} from './model'

export function dfdOf(view: DiagramView): DfdPayload {
  return view.dfd ?? { nodes: {}, flows: {}, boundaries: {}, groups: {}, nextNumber: 1 }
}

/** The DFD kind expected for a scope element: only a software system owns DFDs (decision: dfd-container-level-only). */
export function dfdKindOfScope(project: Project, scopeId: string | null): ViewKind | undefined {
  const scope = scopeId ? project.elements[scopeId] : undefined
  return scope?.kind === 'softwareSystem' ? 'dfd_container' : undefined
}

/** Data store kinds that queue or publish data (kept for the item mapping). */
function isQueueStore(element: Element) {
  return element.kind === 'container' && effectiveCategory(element) === 'dataStore' && (element.dataStoreKind === 'pubSub' || element.dataStoreKind === 'queue')
}
void isItemStore

/**
 * The role an element takes in a DFD at component granularity (decision: dfd-component-granularity): the system's
 * components are processes (a passthrough component is the API document it handles), tables are stores, topics are
 * queues, folders are files; containers are never nodes and people become the start marker, so both return undefined;
 * anything outside the system is an external entity.
 */
export function roleForElement(project: Project, view: Pick<DiagramView, 'kind' | 'scopeId'>, element: Element): { role: DfdRole; intermediateKind?: IntermediateKind } | undefined {
  if (element.kind === 'entity') return { role: 'data_store' }
  // A repository is implied by the process that writes its tables; it is never drawn (decision: dfd-passthrough-components).
  if (element.kind === 'component' && element.passthrough && isPersistenceComponent(project, element)) return undefined
  if (element.kind === 'topic') return { role: 'intermediate_data', intermediateKind: 'queue' }
  if (element.kind === 'folder') return { role: 'intermediate_data', intermediateKind: 'file' }
  if (element.kind === 'person' || element.kind === 'container') return undefined
  if (element.kind === 'component') {
    const container = element.parentId ? project.elements[element.parentId] : undefined
    const inSystem = (container?.parentId ?? null) === view.scopeId
    if (!inSystem) return { role: 'external_entity' }
    return element.passthrough ? { role: 'intermediate_data', intermediateKind: 'api_document' } : { role: 'process' }
  }
  return { role: 'external_entity' }
  void isQueueStore
}

/** Display name of a node: the bound element's name, or the free node's own. */
export function nodeName(project: Project, node: DfdNode): string {
  const element = node.elementId ? project.elements[node.elementId] : undefined
  return element?.name ?? node.name
}

/** A passthrough component whose stored C4 links reach a data store: a repository or DAO. */
export function isPersistenceComponent(project: Project, element: Element): boolean {
  return Object.values(project.relationships).some((relationship) => {
    const sourceId = relationship.viewEndpoints?.component?.sourceId ?? relationship.sourceId
    const targetId = relationship.viewEndpoints?.component?.targetId ?? relationship.targetId
    const target = project.elements[targetId]
    return sourceId === element.id && target?.kind === 'container' && effectiveCategory(target) === 'dataStore'
  })
}

/** The table a store node should bind to: a dependent (detail) entity folds into its owner (decision: dfd-component-granularity). */
export function storeTargetOf(project: Project, element: Element): Element {
  let current = element
  while (current.kind === 'entity' && current.parentId && project.elements[current.parentId]?.kind === 'entity') current = project.elements[current.parentId]
  return current
}

export function nodeElement(project: Project, node: DfdNode): Element | undefined {
  return node.elementId ? project.elements[node.elementId] : undefined
}

/** Free nodes render as a stub element of the kind they would become, so shared code (legend, export) keeps working. */
export function stubKindFor(node: DfdNode): ElementKind {
  if (node.role === 'external_entity') return 'externalSystem'
  if (node.role === 'diagram_ref' || node.role === 'start') return 'softwareSystem'
  if (node.role === 'data_store') return 'entity'
  if (node.role === 'intermediate_data') return node.intermediateKind === 'queue' ? 'topic' : node.intermediateKind === 'file' ? 'folder' : 'component'
  return 'component'
}

/** The start marker of a DFD, when present (requirement: dfd-flow-direction). */
export function startNodeOf(payload: DfdPayload): DfdNode | undefined {
  return Object.values(payload.nodes).find((node) => node.role === 'start')
}

export type FlowClass = 'process' | 'data' | 'external' | 'ref' | 'start'

/** An API document handled by a passthrough component (a controller, a repository): data toward processes, a process toward stores. */
export function isHandledDocument(node: DfdNode) {
  return node.role === 'intermediate_data' && node.intermediateKind === 'api_document' && Boolean(node.elementId)
}

export function flowClassOf(node: DfdNode): FlowClass {
  if (node.role === 'process') return 'process'
  if (node.role === 'external_entity') return 'external'
  if (node.role === 'diagram_ref') return 'ref'
  if (node.role === 'start') return 'start'
  return 'data'
}

export type ConnectionVerdict = { kind: 'allowed' } | { kind: 'process_to_process' } | { kind: 'data_to_data' } | { kind: 'forbidden' }

/** rule: dfd-connection-policy. A reference node takes the class that makes the pair legal; the start marker only feeds a process. */
export function connectionVerdict(source: DfdNode, target: DfdNode): ConnectionVerdict {
  const a = flowClassOf(source)
  const b = flowClassOf(target)
  if (a === 'start') return b === 'process' ? { kind: 'allowed' } : { kind: 'forbidden' }
  if (b === 'start') return { kind: 'forbidden' }
  if (a === 'ref' || b === 'ref') return { kind: 'allowed' }
  if (a === 'process' && b === 'process') return { kind: 'process_to_process' }
  // A handled document writes to and reads from stores on its component's behalf (decision: dfd-passthrough-components).
  if (a === 'data' && b === 'data' && (isHandledDocument(source) !== isHandledDocument(target))) return { kind: 'allowed' }
  if (a === 'data' && b === 'data') return { kind: 'data_to_data' }
  return { kind: 'allowed' }
}

/** True when either endpoint is a data store, so CRUD operations may be recorded on the flow. */
export function touchesStore(payload: DfdPayload, flow: Pick<DfdFlow, 'sourceNodeId' | 'targetNodeId'>) {
  return payload.nodes[flow.sourceNodeId]?.role === 'data_store' || payload.nodes[flow.targetNodeId]?.role === 'data_store'
}

/** Store end of a flow: 'source' when the store sends (read), 'target' when it receives (write). */
export function storeEnd(payload: DfdPayload, flow: Pick<DfdFlow, 'sourceNodeId' | 'targetNodeId'>): 'source' | 'target' | undefined {
  if (payload.nodes[flow.targetNodeId]?.role === 'data_store') return 'target'
  if (payload.nodes[flow.sourceNodeId]?.role === 'data_store') return 'source'
  return undefined
}

/** Default operations: reading from a store is R, writing into it is C (rule: dfd-connection-policy). */
export function defaultOperations(payload: DfdPayload, flow: Pick<DfdFlow, 'sourceNodeId' | 'targetNodeId'>): CrudOperation[] {
  const end = storeEnd(payload, flow)
  if (end === 'source') return ['R']
  if (end === 'target') return ['C']
  return []
}

export function nextProcessNumber(payload: DfdPayload): { number: string; payload: DfdPayload } {
  return { number: String(payload.nextNumber), payload: { ...payload, nextNumber: payload.nextNumber + 1 } }
}

/** Every DFD view of the project, optionally those of one scope. */
export function dfdViews(project: Project, scopeId?: string | null): DiagramView[] {
  return Object.values(project.views).filter((view) => isDfdView(view.kind) && (scopeId === undefined || view.scopeId === scopeId))
    .sort((a, b) => (a.useCase ?? '').localeCompare(b.useCase ?? '') || a.name.localeCompare(b.name))
}

/** DFDs in which an element appears, with the nodes that project it (requirement: use-case-dfd inspector list). */
export function dfdUsage(project: Project, elementId: string): Array<{ view: DiagramView; node: DfdNode }> {
  return dfdViews(project).flatMap((view) => Object.values(dfdOf(view).nodes).filter((node) => node.elementId === elementId).map((node) => ({ view, node })))
}

/**
 * The C4 element a node stands for when deriving relationships (decision: dfd-drives-c4): a component is itself, a
 * table, topic, or folder is its data store container (C4 stops at the store), a document handled by a passthrough
 * component is that component; free nodes, the start marker, and unbound documents stand for nothing.
 */
export function c4CounterpartOf(project: Project, node: DfdNode): Element | undefined {
  const element = nodeElement(project, node)
  if (!element) return undefined
  if (element.kind === 'entity') return storeOf(project, element)
  if (element.kind === 'topic' || element.kind === 'folder') return element.parentId ? project.elements[element.parentId] : undefined
  return element
}

function relationshipPairs(relationship: Relationship): Array<[string, string]> {
  const pairs: Array<[string, string]> = [[relationship.sourceId, relationship.targetId]]
  Object.values(relationship.viewEndpoints ?? {}).forEach((endpoints) => { if (endpoints) pairs.push([endpoints.sourceId, endpoints.targetId]) })
  return pairs
}

/** True when some C4 relationship links a (or an ancestor) with b (or an ancestor), either direction (rule: dfd-c4-pairing consistency). */
export function hasC4Link(project: Project, a: Element, b: Element): boolean {
  const chainA = new Set(ancestorIds(project, a.id))
  const chainB = new Set(ancestorIds(project, b.id))
  return Object.values(project.relationships).some((relationship) => relationshipPairs(relationship).some(([source, target]) => source !== target && ((chainA.has(source) && chainB.has(target)) || (chainB.has(source) && chainA.has(target)))))
}

// ---------- placing free nodes into the model ----------

export interface PlacementOption {
  id: string
  /** Element created when the option is applied. */
  kind: ElementKind
  parentId?: string
  patch: Partial<Element>
  /** Create this container first and place the element inside it; placeholder marks the system's "Unknown container". */
  newContainer?: { parentId: string; containerCategory: 'application' | 'dataStore'; applicationKind?: Element['applicationKind']; dataStoreKind?: Element['dataStoreKind']; sqlDialect?: Element['sqlDialect']; placeholder?: boolean }
}

/**
 * Where a free node can be placed: a process becomes an application container of the system (UI, server, or
 * worker, which also drives representative selection in decision:dfd-logical-process-group), a store a data
 * store container or a table in one of the system's databases, an external entity a person or external system.
 */
export const PLACEHOLDER_CONTAINER_NAME = 'Unknown container'

/**
 * Where a free node can be placed (decision: dfd-component-granularity): a process becomes a component of an existing
 * container, of a new container, or of the system's placeholder; a store a table of an existing or new database; a queue a
 * topic of an existing or new pub/sub; a file a folder of an existing or new bucket; an API document a passthrough
 * component; an external entity an external system. Options with newContainer create that container first.
 */
export function placementOptionsFor(project: Project, view: DiagramView, node: DfdNode): PlacementOption[] {
  const system = view.scopeId ? project.elements[view.scopeId] : undefined
  const options: PlacementOption[] = []
  if (!system) return node.role === 'external_entity' ? [{ id: 'externalSystem', kind: 'externalSystem', patch: {} }] : []
  const containers = childrenOf(project, system.id).filter((element) => element.kind === 'container')
  const applications = containers.filter((element) => effectiveCategory(element) === 'application' && !element.placeholder)
  if (node.role === 'process' || (node.role === 'intermediate_data' && node.intermediateKind === 'api_document')) {
    const patch = node.role === 'process' ? {} : { passthrough: true }
    applications.forEach((container) => options.push({ id: `component:${container.id}`, kind: 'component', parentId: container.id, patch }))
    options.push({ id: 'newServer', kind: 'component', patch, newContainer: { parentId: system.id, containerCategory: 'application', applicationKind: 'server' } })
    options.push({ id: 'newScreen', kind: 'component', patch, newContainer: { parentId: system.id, containerCategory: 'application', applicationKind: 'webBrowser' } })
    options.push({ id: 'newWorker', kind: 'component', patch, newContainer: { parentId: system.id, containerCategory: 'application', applicationKind: 'worker' } })
    options.push({ id: 'placeholder', kind: 'component', patch, newContainer: { parentId: system.id, containerCategory: 'application', applicationKind: 'other', placeholder: true } })
  }
  if (node.role === 'data_store') {
    containers.filter(isErdStore).forEach((store) => options.push({ id: `entity:${store.id}`, kind: 'entity', parentId: store.id, patch: { classification: 'resource' } }))
    options.push({ id: 'newDatabase', kind: 'entity', patch: { classification: 'resource' }, newContainer: { parentId: system.id, containerCategory: 'dataStore', dataStoreKind: 'database', sqlDialect: 'postgresql' } })
  }
  if (node.role === 'intermediate_data' && node.intermediateKind === 'queue') {
    containers.filter((store) => itemKindFor(store) === 'topic').forEach((store) => options.push({ id: `topic:${store.id}`, kind: 'topic', parentId: store.id, patch: {} }))
    options.push({ id: 'newPubSub', kind: 'topic', patch: {}, newContainer: { parentId: system.id, containerCategory: 'dataStore', dataStoreKind: 'pubSub' } })
  }
  if (node.role === 'intermediate_data' && node.intermediateKind === 'file') {
    containers.filter((store) => itemKindFor(store) === 'folder').forEach((store) => options.push({ id: `folder:${store.id}`, kind: 'folder', parentId: store.id, patch: {} }))
    options.push({ id: 'newBucket', kind: 'folder', patch: {}, newContainer: { parentId: system.id, containerCategory: 'dataStore', dataStoreKind: 'bucket' } })
  }
  if (node.role === 'external_entity') options.push({ id: 'externalSystem', kind: 'externalSystem', patch: {} })
  return options
}

/** Existing elements a free node may be bound to: those that would take the node's role in this DFD. */
export function bindCandidatesFor(project: Project, view: DiagramView, node: DfdNode): Element[] {
  const used = new Set(Object.values(dfdOf(view).nodes).map((other) => other.elementId).filter(Boolean))
  return Object.values(project.elements).filter((element) => {
    if (used.has(element.id)) return false
    if (element.kind === 'entity' && storeTargetOf(project, element).id !== element.id) return false
    const derived = roleForElement(project, view, element)
    if (!derived || derived.role !== node.role) return false
    if (node.role === 'intermediate_data' && derived.intermediateKind !== node.intermediateKind) return false
    return true
  }).sort((a, b) => a.name.localeCompare(b.name))
}

// ---------- C4 links into a DFD (requirement: c4-links-into-dfd) ----------

export interface ImportableLink {
  relationship: Relationship
  sourceNodeId: string
  targetNodeId: string
  /** A passthrough component in the middle of A -> C -> B, bound to the document of the imported hop. */
  viaNodeId?: string
  viaElementId?: string
}

function componentEndpoints(project: Project, relationship: Relationship): { sourceId: string; targetId: string } | undefined {
  const mapped = relationship.viewEndpoints?.component
  const sourceId = mapped?.sourceId ?? relationship.sourceId
  const targetId = mapped?.targetId ?? relationship.targetId
  if (project.elements[sourceId]?.kind !== 'component' || project.elements[targetId]?.kind !== 'component') return undefined
  return { sourceId, targetId }
}

/** Stored 1:1 component links between nodes of this DFD that no flow carries yet, plus A -> C -> B chains through a passthrough component. */
export function importableLinks(project: Project, view: DiagramView): ImportableLink[] {
  const payload = dfdOf(view)
  const nodeByElement = new Map(Object.values(payload.nodes).filter((node) => node.elementId).map((node) => [node.elementId!, node]))
  const carried = new Set(Object.values(payload.flows).map((flow) => flow.relationshipRef).filter(Boolean))
  const flows = Object.values(payload.flows)
  // A hop already drawn between the two nodes, directly or through one intermediate node, needs no import.
  const hopExists = (sourceId: string, targetId: string) => flows.some((flow) => flow.sourceNodeId === sourceId && (flow.targetNodeId === targetId || (payload.nodes[flow.targetNodeId]?.role === 'intermediate_data' && flows.some((next) => next.sourceNodeId === flow.targetNodeId && next.targetNodeId === targetId))))
  const links: ImportableLink[] = []
  const stored = Object.values(project.relationships).filter((relationship) => !relationship.derived)
  stored.forEach((relationship) => {
    if (carried.has(relationship.id)) return
    const endpoints = componentEndpoints(project, relationship)
    if (!endpoints) return
    const source = nodeByElement.get(endpoints.sourceId)
    const target = nodeByElement.get(endpoints.targetId)
    if (source?.role === 'process' && target?.role === 'process') { if (!hopExists(source.id, target.id)) links.push({ relationship, sourceNodeId: source.id, targetNodeId: target.id }); return }
    // A -> C -> B with C passthrough: offer the chain as one hop whose document C handles.
    const via = project.elements[endpoints.targetId]
    if (source?.role === 'process' && via?.passthrough && !target) {
      stored.filter((next) => next.id !== relationship.id && !carried.has(next.id)).forEach((next) => {
        const onward = componentEndpoints(project, next)
        if (!onward || onward.sourceId !== via.id) return
        const end = nodeByElement.get(onward.targetId)
        if (end?.role === 'process' && !hopExists(source.id, end.id)) links.push({ relationship, sourceNodeId: source.id, targetNodeId: end.id, viaElementId: via.id, viaNodeId: nodeByElement.get(via.id)?.id })
      })
    }
  })
  return links
}

// ---------- logical process groups (decision: dfd-logical-process-group) ----------

/** The group a node or group is a direct member of, if any. */
export function groupOf(payload: DfdPayload, memberId: string): DfdGroup | undefined {
  return Object.values(payload.groups).find((group) => group.memberIds.includes(memberId))
}

/** Every node id inside a group, through nested groups. */
export function descendantNodeIds(payload: DfdPayload, groupId: string, seen = new Set<string>()): string[] {
  const group = payload.groups[groupId]
  if (!group || seen.has(groupId)) return []
  seen.add(groupId)
  return group.memberIds.flatMap((id) => (payload.groups[id] ? descendantNodeIds(payload, id, seen) : payload.nodes[id] ? [id] : []))
}

/** Group ids from the outermost down to the direct parent of a member. */
export function groupChain(payload: DfdPayload, memberId: string): string[] {
  const chain: string[] = []
  let current = groupOf(payload, memberId)
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) { chain.unshift(current.id); seen.add(current.id); current = groupOf(payload, current.id) }
  return chain
}

/** The nearest visible ancestor of a member given the collapsed groups, or the member itself. */
export function visibleIdOf(payload: DfdPayload, memberId: string, collapsed: Set<string>): string {
  const chain = groupChain(payload, memberId)
  const outermostCollapsed = chain.find((id) => collapsed.has(id))
  return outermostCollapsed ?? memberId
}

/** Members that count as units of a group: processes and nested groups, not the intermediate data between them. */
export function groupUnits(payload: DfdPayload, group: DfdGroup): string[] {
  return group.memberIds.filter((id) => payload.groups[id] || payload.nodes[id]?.role === 'process')
}

/**
 * The member process that gives a group its name, picture, and reading: a UI first, then a batch worker, then the
 * most upstream server (no incoming flow from inside the group), then the first member.
 */
export function representativeOf(project: Project, payload: DfdPayload, group: DfdGroup): DfdNode | undefined {
  const processes = descendantNodeIds(payload, group.id).map((id) => payload.nodes[id]).filter((node) => node?.role === 'process')
  if (!processes.length) return undefined
  // Screens first, then jobs, then the most upstream member (decision: dfd-logical-process-group, component granularity).
  const ui = processes.find((node) => isScreenComponent(project, nodeElement(project, node)))
  if (ui) return ui
  const batch = processes.find((node) => isJobComponent(project, nodeElement(project, node)))
  if (batch) return batch
  const inside = new Set(descendantNodeIds(payload, group.id))
  const flows = Object.values(payload.flows)
  const fedFromInside = (node: DfdNode) => flows.some((flow) => flow.targetNodeId === node.id && inside.has(flow.sourceNodeId))
  const fedViaIntermediate = (node: DfdNode) => flows.some((flow) => flow.targetNodeId === node.id && inside.has(flow.sourceNodeId) && payload.nodes[flow.sourceNodeId]?.role === 'intermediate_data' && flows.some((upstream) => upstream.targetNodeId === flow.sourceNodeId && inside.has(upstream.sourceNodeId)))
  return processes.find((node) => !fedFromInside(node) && !fedViaIntermediate(node)) ?? processes[0]
}

export function groupName(project: Project, payload: DfdPayload, group: DfdGroup): string {
  if (group.name.trim()) return group.name
  const representative = representativeOf(project, payload, group)
  return representative ? nodeName(project, representative) : group.processNumber
}

/**
 * Display numbers: top-level processes and groups keep their stored number; inside a group the units are numbered
 * beneath the group in flow order (1.1, 1.2, 1.1.1), so the nesting reads as a Gane-Sarson decomposition.
 */
export function processNumbers(payload: DfdPayload): Record<string, string> {
  const numbers: Record<string, string> = {}
  const flows = Object.values(payload.flows)
  const assign = (group: DfdGroup, prefix: string) => {
    const units = groupUnits(payload, group)
    const unitSet = new Set(units)
    // A unit reaches another when a flow, possibly through one intermediate member, joins their node sets.
    const nodesOf = (id: string) => new Set(payload.groups[id] ? descendantNodeIds(payload, id) : [id])
    const nodeToUnit = new Map<string, string>()
    units.forEach((id) => nodesOf(id).forEach((nodeId) => nodeToUnit.set(nodeId, id)))
    const intermediates = new Set(group.memberIds.filter((id) => payload.nodes[id]?.role === 'intermediate_data'))
    const successors = new Map<string, Set<string>>(units.map((id) => [id, new Set<string>()]))
    flows.forEach((flow) => {
      const from = nodeToUnit.get(flow.sourceNodeId)
      let to = nodeToUnit.get(flow.targetNodeId)
      if (!to && intermediates.has(flow.targetNodeId)) {
        const onward = flows.find((next) => next.sourceNodeId === flow.targetNodeId && nodeToUnit.has(next.targetNodeId))
        to = onward ? nodeToUnit.get(onward.targetNodeId) : undefined
      }
      if (from && to && from !== to && unitSet.has(from) && unitSet.has(to)) successors.get(from)!.add(to)
    })
    const indegree = new Map(units.map((id) => [id, 0]))
    successors.forEach((targets) => targets.forEach((target) => indegree.set(target, (indegree.get(target) ?? 0) + 1)))
    const ordered: string[] = []
    const ready = units.filter((id) => (indegree.get(id) ?? 0) === 0)
    const remaining = new Set(units)
    while (remaining.size) {
      const next = ready.shift() ?? [...remaining][0]
      if (!remaining.has(next)) continue
      remaining.delete(next)
      ordered.push(next)
      successors.get(next)?.forEach((target) => { indegree.set(target, (indegree.get(target) ?? 1) - 1); if ((indegree.get(target) ?? 0) === 0 && remaining.has(target)) ready.push(target) })
    }
    ordered.forEach((id, index) => {
      const number = `${prefix}.${index + 1}`
      numbers[id] = number
      if (payload.groups[id]) assign(payload.groups[id], number)
    })
  }
  // Top-level units are numbered 1..n in the order their stored numbers were assigned, so grouping leaves no gaps.
  const topLevel = (id: string) => !groupOf(payload, id)
  const stored = (value: string) => value.split('.').map(Number)
  const units = [
    ...Object.values(payload.nodes).filter((node) => node.role === 'process' && node.processNumber && topLevel(node.id)).map((node) => ({ id: node.id, number: node.processNumber! })),
    ...Object.values(payload.groups).filter((group) => topLevel(group.id)).map((group) => ({ id: group.id, number: group.processNumber })),
  ].sort((x, y) => { const a = stored(x.number); const b = stored(y.number); for (let i = 0; i < Math.max(a.length, b.length); i += 1) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return d } return 0 })
  units.forEach((unit, index) => {
    const number = String(index + 1)
    numbers[unit.id] = number
    if (payload.groups[unit.id]) assign(payload.groups[unit.id], number)
  })
  return numbers
}

// ---------- derived C4 relationships (decision: dfd-drives-c4) ----------

/**
 * C4 relationships computed from DFD flows: a flow between two nodes with C4 counterparts derives counterpart ->
 * counterpart (a store end always becomes the target: the process uses the store); a hop through an unbound
 * intermediate node derives the two processes' link; a flow carrying relationship_ref derives nothing. One record per
 * element pair and direction, listing every contributing flow.
 */
export function derivedRelationships(project: Project): Record<string, Relationship> {
  const derived: Record<string, Relationship> = {}
  const stored = Object.values(project.relationships)
  const endpointsOf = (relationship: Relationship) => ({ sourceId: relationship.viewEndpoints?.component?.sourceId ?? relationship.sourceId, targetId: relationship.viewEndpoints?.component?.targetId ?? relationship.targetId })
  // A stored path source -> passthrough component -> target already explains a direct flow; no derived line then.
  const explainedByPassthrough = (sourceId: string, targetId: string) => stored.some((first) => {
    const a = endpointsOf(first)
    const via = project.elements[a.targetId]
    return a.sourceId === sourceId && via?.kind === 'component' && via.passthrough && stored.some((second) => { const b = endpointsOf(second); return b.sourceId === via.id && b.targetId === targetId })
  })
  const add = (a: Element, b: Element, flow: DfdFlow, viewId: string) => {
    if (a.id === b.id) return
    const aStore = a.kind === 'container' && effectiveCategory(a) === 'dataStore'
    const bStore = b.kind === 'container' && effectiveCategory(b) === 'dataStore'
    if (aStore && bStore) return
    const [source, target] = aStore ? [b, a] : [a, b]
    if (explainedByPassthrough(source.id, target.id)) return
    const id = `derived:${source.id}->${target.id}`
    const existing = derived[id]
    const labels = [...new Set([...(existing?.label.split('\n') ?? []), flow.label.trim()].filter(Boolean))]
    const technologies = [...new Set([...(existing?.technology?.split(' / ') ?? []), flow.technology.trim()].filter(Boolean))]
    derived[id] = { id, sourceId: source.id, targetId: target.id, label: labels.join('\n'), technology: technologies.join(' / ') || undefined, derived: { members: [...(existing?.derived?.members ?? []), { viewId, flowId: flow.id }] } }
  }
  dfdViews(project).forEach((view) => {
    const payload = dfdOf(view)
    const flows = Object.values(payload.flows)
    flows.forEach((flow) => {
      if (flow.relationshipRef && project.relationships[flow.relationshipRef]) return
      const source = payload.nodes[flow.sourceNodeId]
      const target = payload.nodes[flow.targetNodeId]
      if (!source || !target) return
      const a = c4CounterpartOf(project, source)
      const b = c4CounterpartOf(project, target)
      if (a && b) { add(a, b, flow, view.id); return }
      // Through an unbound intermediate node: the flow into it and the flow out of it make one link.
      if (a && !b && target.role === 'intermediate_data' && !target.elementId) {
        flows.filter((onward) => onward.sourceNodeId === target.id && !(onward.relationshipRef && project.relationships[onward.relationshipRef])).forEach((onward) => {
          const end = payload.nodes[onward.targetNodeId]
          const c = end ? c4CounterpartOf(project, end) : undefined
          if (c) add(a, c, onward, view.id)
        })
      }
    })
  })
  return derived
}

/** Stored relationships plus the derived ones, for rendering and checks. */
export function allRelationships(project: Project): Record<string, Relationship> {
  return { ...derivedRelationships(project), ...project.relationships }
}

// Pure project commands. Each returns a new project; the UI wraps them in history.
import { defaultOperations, descendantNodeIds, dfdOf, groupOf, groupUnits, importableLinks, nextProcessNumber, nodeName, PLACEHOLDER_CONTAINER_NAME, representativeOf, roleForElement, startNodeOf, storeTargetOf, type ImportableLink, type PlacementOption } from './dfd'
import { childrenOf, defaultAttributesFor, dependentRelationship, emptyDfdPayload, isDfdView, isScreenComponent, makeAttribute, makeId, type Attribute, type Consistency, type DfdBoundary, type DfdFlow, type DfdGroup, type DfdNode, type DfdPayload, type DfdRole, type DiagramView, type Element, type Group, type IntermediateKind, type Position, type Project, type Rect, type Relationship, type ViewKind } from './model'
import { pruneDomains, syncAttributeDomains } from './domains'
import { makeView } from './views'

/** Stores an element; an entity's changed field list keeps its fields on domains (decision: field-first-domains). */
export function upsertElement(project: Project, element: Element): Project {
  const previous = project.elements[element.id]
  if (element.kind !== 'entity' || !element.attributes || previous?.attributes === element.attributes) return { ...project, elements: { ...project.elements, [element.id]: element } }
  const synced = syncAttributeDomains(project, previous?.attributes ?? [], element.attributes)
  const next = { ...synced.project, elements: { ...synced.project.elements, [element.id]: { ...element, attributes: synced.attributes } } }
  return pruneDomains(next, synced.released)
}

export function patchElement(project: Project, id: string, patch: Partial<Element>): Project {
  const current = project.elements[id]
  if (!current) return project
  return upsertElement(project, { ...current, ...patch })
}

export function createElement(project: Project, input: Omit<Element, 'id'> & { id?: string }): { project: Project; element: Element } {
  const element: Element = { ...input, id: input.id ?? makeId(input.kind) }
  return { project: upsertElement(project, element), element }
}

/** Deletes an element, its descendants, their relationships, view refs, layouts, and groups. */
export function deleteElements(project: Project, ids: string[]): { project: Project; deletedIds: string[] } {
  const toDelete = new Set<string>()
  const collect = (id: string) => {
    if (toDelete.has(id)) return
    toDelete.add(id)
    Object.values(project.elements).filter((element) => element.parentId === id).forEach((child) => collect(child.id))
  }
  ids.forEach(collect)
  const elements = Object.fromEntries(Object.entries(project.elements).filter(([id]) => !toDelete.has(id)))
  const relationships = Object.fromEntries(Object.entries(project.relationships).filter(([, relationship]) => !toDelete.has(relationship.sourceId) && !toDelete.has(relationship.targetId)))
  const groups = Object.fromEntries(Object.entries(project.groups).filter(([, group]) => !(group.scopeId && toDelete.has(group.scopeId))))
  const views = Object.fromEntries(Object.entries(project.views)
    .filter(([, view]) => !(view.scopeId && toDelete.has(view.scopeId)))
    .map(([id, view]) => [id, {
      ...view,
      elementRefs: view.elementRefs.filter((ref) => !toDelete.has(ref)),
      layout: { ...view.layout, positions: Object.fromEntries(Object.entries(view.layout.positions).filter(([ref]) => !toDelete.has(ref) || view.dfd)) },
      // A DFD keeps its picture: nodes bound to a deleted element become free nodes carrying the old name (decision: dfd-first-free-nodes).
      dfd: view.dfd ? { ...view.dfd, nodes: Object.fromEntries(Object.entries(view.dfd.nodes).map(([nodeId, node]) => [nodeId, node.elementId && toDelete.has(node.elementId) ? { ...node, elementId: undefined, name: project.elements[node.elementId]?.name ?? node.name } : node])) } : undefined,
    }]))
  const released = [...toDelete].flatMap((id) => (project.elements[id]?.attributes ?? []).map((attribute) => attribute.domainId ?? ''))
  return { project: pruneDomains({ ...project, elements, relationships, groups, views }, released), deletedIds: [...toDelete] }
}

export function createRelationship(project: Project, input: Omit<Relationship, 'id'> & { id?: string }): { project: Project; relationship: Relationship } {
  const relationship: Relationship = { ...input, id: input.id ?? makeId('rel') }
  return { project: { ...project, relationships: { ...project.relationships, [relationship.id]: relationship } }, relationship }
}

export function patchRelationship(project: Project, id: string, patch: Partial<Relationship>): Project {
  const current = project.relationships[id]
  if (!current) return project
  return { ...project, relationships: { ...project.relationships, [id]: { ...current, ...patch } } }
}

export function deleteRelationship(project: Project, id: string): Project {
  const relationships = { ...project.relationships }
  delete relationships[id]
  return { ...project, relationships }
}

export function upsertView(project: Project, view: DiagramView): Project {
  return { ...project, views: { ...project.views, [view.id]: view } }
}

export function patchView(project: Project, id: string, patch: Partial<DiagramView>): Project {
  const current = project.views[id]
  if (!current) return project
  return upsertView(project, { ...current, ...patch })
}

export function createView(project: Project, kind: ViewKind, scopeId: string | null, name: string, copyFrom?: DiagramView): { project: Project; view: DiagramView } {
  const hasDefault = Object.values(project.views).some((view) => view.kind === kind && view.scopeId === scopeId && view.isDefault)
  const view = makeView(kind, scopeId, name, !hasDefault)
  if (copyFrom) {
    view.elementRefs = [...copyFrom.elementRefs]
    view.displayMode = copyFrom.displayMode
    view.layout = { positions: { ...copyFrom.layout.positions }, boundary: copyFrom.layout.boundary ? { ...copyFrom.layout.boundary } : undefined }
    if (copyFrom.dfd) { view.dfd = JSON.parse(JSON.stringify(copyFrom.dfd)) as DfdPayload; view.useCase = copyFrom.useCase }
  }
  return { project: upsertView(project, view), view }
}

export function deleteView(project: Project, id: string): Project {
  const target = project.views[id]
  if (!target) return project
  const views = { ...project.views }
  delete views[id]
  if (target.isDefault) {
    const sibling = Object.values(views).find((view) => view.kind === target.kind && view.scopeId === target.scopeId)
    if (sibling) views[sibling.id] = { ...sibling, isDefault: true }
  }
  // Off-page references into the deleted DFD go with it, together with their flows.
  Object.values(views).forEach((view) => {
    if (!view.dfd) return
    const dangling = Object.values(view.dfd.nodes).filter((node) => node.role === 'diagram_ref' && node.targetViewId === id).map((node) => node.id)
    if (dangling.length) views[view.id] = removeNodes(view, dangling)
  })
  return { ...project, views }
}

export function setDefaultView(project: Project, id: string): Project {
  const target = project.views[id]
  if (!target) return project
  const views = Object.fromEntries(Object.entries(project.views).map(([viewId, view]) => [viewId, view.kind === target.kind && view.scopeId === target.scopeId ? { ...view, isDefault: viewId === id } : view]))
  return { ...project, views }
}

export function setPositions(project: Project, viewId: string, positions: Record<string, Position>, boundary?: Rect): Project {
  const view = project.views[viewId]
  if (!view) return project
  return upsertView(project, { ...view, layout: { positions: { ...view.layout.positions, ...positions }, boundary: boundary ?? view.layout.boundary } })
}

export function setBoundary(project: Project, viewId: string, boundary: Rect): Project {
  const view = project.views[viewId]
  if (!view) return project
  return upsertView(project, { ...view, layout: { ...view.layout, boundary } })
}

export function createGroup(project: Project, input: Omit<Group, 'id'>): { project: Project; group: Group } {
  const group: Group = { ...input, id: makeId('group') }
  return { project: { ...project, groups: { ...project.groups, [group.id]: group } }, group }
}

export function patchGroup(project: Project, id: string, patch: Partial<Group>): Project {
  const current = project.groups[id]
  if (!current) return project
  return { ...project, groups: { ...project.groups, [id]: { ...current, ...patch } } }
}

/** Removing a group clears members' group ids and reparents nested groups to its parent. */
export function deleteGroup(project: Project, id: string): Project {
  const target = project.groups[id]
  if (!target) return project
  const groups = Object.fromEntries(Object.entries(project.groups)
    .filter(([groupId]) => groupId !== id)
    .map(([groupId, group]) => [groupId, group.parentGroupId === id ? { ...group, parentGroupId: target.parentGroupId } : group]))
  const elements = Object.fromEntries(Object.entries(project.elements).map(([elementId, element]) => [elementId, element.groupId === id ? { ...element, groupId: undefined } : element]))
  return { ...project, groups, elements }
}

export function setElementGroup(project: Project, elementId: string, groupId: string | undefined): Project {
  return patchElement(project, elementId, { groupId })
}

/** Creates an entity with its surrogate key; under an owner entity it also creates the dependent relationship. */
export function createEntity(project: Project, input: Omit<Element, 'id' | 'kind'> & { id?: string }): { project: Project; element: Element } {
  const created = createElement(project, { ...input, kind: 'entity', attributes: input.attributes ?? defaultAttributesFor(input.name) })
  const owner = input.parentId ? created.project.elements[input.parentId] : undefined
  if (owner?.kind !== 'entity') return created
  return { project: createRelationship(created.project, { sourceId: owner.id, targetId: created.element.id, label: '', erd: dependentRelationship() }).project, element: created.element }
}

// ---------- entity attributes ----------

export function addAttribute(project: Project, entityId: string, name: string, patch: Partial<Attribute> = {}): { project: Project; attribute: Attribute } {
  const entity = project.elements[entityId]
  const attribute = makeAttribute(name, patch)
  if (!entity || entity.kind !== 'entity') return { project, attribute }
  return { project: patchElement(project, entityId, { attributes: [...(entity.attributes ?? []), attribute] }), attribute }
}

export function patchAttribute(project: Project, entityId: string, attributeId: string, patch: Partial<Attribute>): Project {
  const entity = project.elements[entityId]
  if (!entity?.attributes?.some((attribute) => attribute.id === attributeId)) return project
  return patchElement(project, entityId, { attributes: entity.attributes.map((attribute) => (attribute.id === attributeId ? { ...attribute, ...patch } : attribute)) })
}

export function deleteAttribute(project: Project, entityId: string, attributeId: string): Project {
  const entity = project.elements[entityId]
  if (!entity?.attributes) return project
  return patchElement(project, entityId, { attributes: entity.attributes.filter((attribute) => attribute.id !== attributeId) })
}

/** Moves an attribute up (-1) or down (+1) in the field order. */
export function moveAttribute(project: Project, entityId: string, attributeId: string, delta: -1 | 1): Project {
  const entity = project.elements[entityId]
  const attributes = [...(entity?.attributes ?? [])]
  const index = attributes.findIndex((attribute) => attribute.id === attributeId)
  const target = index + delta
  if (index < 0 || target < 0 || target >= attributes.length) return project
  ;[attributes[index], attributes[target]] = [attributes[target], attributes[index]]
  return patchElement(project, entityId, { attributes })
}


// ---------- DFD ----------

function withDfd(project: Project, viewId: string, mutate: (payload: DfdPayload, view: DiagramView) => DfdPayload): Project {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind)) return project
  return upsertView(project, { ...view, dfd: mutate(dfdOf(view), view) })
}

/** A new DFD of the given kind and scope; the first DFD of a scope becomes its default (data:diagram-view). */
export function createDfd(project: Project, kind: ViewKind, scopeId: string | null, useCase: string): { project: Project; view: DiagramView } {
  const hasDefault = Object.values(project.views).some((view) => view.kind === kind && view.scopeId === scopeId && view.isDefault)
  const start: DfdNode = { id: makeId('node'), role: 'start', name: '', description: '', technology: '' }
  const view: DiagramView = { ...makeView(kind, scopeId, '', !hasDefault), useCase, dfd: { ...emptyDfdPayload(), nodes: { [start.id]: start } }, layout: { positions: { [start.id]: { x: 40, y: 120 } } } }
  return { project: upsertView(project, view), view }
}

/** Adds the start marker to a DFD that lacks one (older payloads). */
export function ensureStartNode(project: Project, viewId: string): Project {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind) || startNodeOf(dfdOf(view))) return project
  const start: DfdNode = { id: makeId('node'), role: 'start', name: '', description: '', technology: '' }
  const payload = dfdOf(view)
  return upsertView(project, { ...view, dfd: { ...payload, nodes: { ...payload.nodes, [start.id]: start } } })
}

/** Adds a node that projects an existing element; its role derives from the element's position (rule: dfd-c4-pairing). */
export function addBoundNode(project: Project, viewId: string, elementId: string, position?: Position): { project: Project; node?: DfdNode } {
  const view = project.views[viewId]
  const dropped = project.elements[elementId]
  // A dependent (detail) table folds into its owner (decision: dfd-component-granularity).
  const element = dropped?.kind === 'entity' ? storeTargetOf(project, dropped) : dropped
  if (!view || !element || !isDfdView(view.kind)) return { project }
  elementId = element.id
  const already = Object.values(dfdOf(view).nodes).find((node) => node.elementId === elementId)
  if (already) return { project, node: already }
  const derived = roleForElement(project, view, element)
  if (!derived) return { project }
  let payload = dfdOf(view)
  let processNumber: string | undefined
  if (derived.role === 'process') { const next = nextProcessNumber(payload); processNumber = next.number; payload = next.payload }
  const node: DfdNode = { id: makeId('node'), role: derived.role, elementId, name: '', description: '', technology: '', intermediateKind: derived.intermediateKind, processNumber }
  payload = { ...payload, nodes: { ...payload.nodes, [node.id]: node } }
  let next = upsertView(project, { ...view, dfd: payload })
  if (position) next = setPositions(next, viewId, { [node.id]: position })
  return { project: next, node }
}

/** Adds a free node: created in the DFD first, placed into C4 or an ERD later (decision: dfd-first-free-nodes). */
export function addFreeNode(project: Project, viewId: string, input: { role: DfdRole; name: string; description?: string; technology?: string; intermediateKind?: IntermediateKind; targetViewId?: string }, position?: Position): { project: Project; node?: DfdNode } {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind)) return { project }
  let payload = dfdOf(view)
  let processNumber: string | undefined
  if (input.role === 'process') { const next = nextProcessNumber(payload); processNumber = next.number; payload = next.payload }
  const node: DfdNode = { id: makeId('node'), role: input.role, name: input.name, description: input.description ?? '', technology: input.technology ?? '', intermediateKind: input.role === 'intermediate_data' ? input.intermediateKind ?? 'file' : undefined, processNumber, targetViewId: input.role === 'diagram_ref' ? input.targetViewId : undefined }
  payload = { ...payload, nodes: { ...payload.nodes, [node.id]: node } }
  let next = upsertView(project, { ...view, dfd: payload })
  if (position) next = setPositions(next, viewId, { [node.id]: position })
  return { project: next, node }
}

export function patchNode(project: Project, viewId: string, nodeId: string, patch: Partial<DfdNode>): Project {
  return withDfd(project, viewId, (payload) => (payload.nodes[nodeId] ? { ...payload, nodes: { ...payload.nodes, [nodeId]: { ...payload.nodes[nodeId], ...patch } } } : payload))
}

function removeNodes(view: DiagramView, nodeIds: string[]): DiagramView {
  const gone = new Set(nodeIds)
  const payload = dfdOf(view)
  const flows = Object.fromEntries(Object.entries(payload.flows).filter(([, flow]) => !gone.has(flow.sourceNodeId) && !gone.has(flow.targetNodeId)))
  const boundaries = Object.fromEntries(Object.entries(payload.boundaries).map(([id, boundary]) => [id, { ...boundary, flowIds: boundary.flowIds.filter((flowId) => flows[flowId]) }]))
  const nodes = Object.fromEntries(Object.entries(payload.nodes).filter(([id]) => !gone.has(id)))
  const groups = Object.fromEntries(Object.entries(payload.groups).map(([id, group]) => [id, { ...group, memberIds: group.memberIds.filter((memberId) => !gone.has(memberId)) }]))
  return dissolveThinGroups({ ...view, dfd: { ...payload, nodes, flows, boundaries, groups }, layout: { ...view.layout, positions: Object.fromEntries(Object.entries(view.layout.positions).filter(([id]) => !gone.has(id))) } })
}

/** A group with fewer than two units (processes or groups) dissolves; its members return to the level above. */
function dissolveThinGroups(view: DiagramView): DiagramView {
  let current = view
  for (let guard = 0; guard < 50; guard += 1) {
    const payload = dfdOf(current)
    const thin = Object.values(payload.groups).find((group) => groupUnits(payload, group).length < 2)
    if (!thin) break
    current = ungroup(current, thin.id)
  }
  return current
}

function ungroup(view: DiagramView, groupId: string): DiagramView {
  const payload = dfdOf(view)
  const target = payload.groups[groupId]
  if (!target) return view
  const groups = { ...payload.groups }
  delete groups[groupId]
  const parent = Object.values(groups).find((group) => group.memberIds.includes(groupId))
  if (parent) groups[parent.id] = { ...parent, memberIds: parent.memberIds.flatMap((id) => (id === groupId ? target.memberIds : [id])) }
  const collapsedGroupIds = (view.layout.collapsedGroupIds ?? []).filter((id) => id !== groupId)
  const positions = { ...view.layout.positions }
  delete positions[groupId]
  return { ...view, dfd: { ...payload, groups }, layout: { ...view.layout, positions, collapsedGroupIds } }
}

/** Removes nodes with their flows; the element they projected stays in the model. */
export function deleteNodes(project: Project, viewId: string, nodeIds: string[]): Project {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind)) return project
  return upsertView(project, removeNodes(view, nodeIds))
}

/** Binds a free node to an existing element: the node now resolves its name from the model. */
export function bindNode(project: Project, viewId: string, nodeId: string, elementId: string): Project {
  const view = project.views[viewId]
  const element = project.elements[elementId]
  if (!view || !element) return project
  const derived = roleForElement(project, view, element)
  if (!derived) return project
  return patchNode(project, viewId, nodeId, { elementId, role: derived.role, intermediateKind: derived.intermediateKind ?? view.dfd?.nodes[nodeId]?.intermediateKind })
}

/** The system's placeholder container, created on demand (decision: dfd-drives-c4). */
export function ensurePlaceholderContainer(project: Project, systemId: string): { project: Project; container: Element } {
  const existing = childrenOf(project, systemId).find((element) => element.kind === 'container' && element.placeholder)
  if (existing) return { project, container: existing }
  const created = createElement(project, { kind: 'container', name: PLACEHOLDER_CONTAINER_NAME, description: '', technology: '', parentId: systemId, containerCategory: 'application', applicationKind: 'other', placeholder: true })
  return { project: created.project, container: created.element }
}

/** Removes placeholder containers that no longer hold anything. */
export function pruneEmptyPlaceholders(project: Project): Project {
  const empty = Object.values(project.elements).filter((element) => element.kind === 'container' && element.placeholder && !childrenOf(project, element.id).length)
  return empty.length ? deleteElements(project, empty.map((element) => element.id)).project : project
}

/**
 * Places a free node into the model: creates the element from the node's text (inside a new container when the
 * option asks for one) and binds the node to it (decision: dfd-first-free-nodes, decision: dfd-component-granularity).
 */
export function placeNode(project: Project, viewId: string, nodeId: string, input: PlacementOption): { project: Project; element?: Element } {
  const view = project.views[viewId]
  const node = view?.dfd?.nodes[nodeId]
  if (!view || !node || node.elementId) return { project }
  let next = project
  let parentId = input.parentId
  if (input.newContainer) {
    if (input.newContainer.placeholder) {
      const placeholder = ensurePlaceholderContainer(next, input.newContainer.parentId)
      next = placeholder.project
      parentId = placeholder.container.id
    } else {
      const { placeholder: _flag, ...fields } = input.newContainer
      const store = fields.containerCategory === 'dataStore'
      const created = createElement(next, { kind: 'container', name: store ? `${nodeName(next, node)} store` : `${nodeName(next, node)} container`, description: '', technology: '', ...fields })
      next = created.project
      parentId = created.element.id
    }
  }
  const base = { name: nodeName(next, node), description: node.description, technology: node.technology, parentId, ...input.patch }
  const created = input.kind === 'entity' ? createEntity(next, base) : createElement(next, { ...base, kind: input.kind })
  return { project: bindNode(created.project, viewId, nodeId, created.element.id), element: created.element }
}

/**
 * Drops a person onto a DFD: people are not nodes, so the start marker connects to the screen the person uses
 * (requirement: dfd-flow-direction). Returns the screen node when one was found.
 */
export function connectStartForPerson(project: Project, viewId: string, personId: string): { project: Project; node?: DfdNode } {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind)) return { project }
  let next = ensureStartNode(project, viewId)
  const payload = dfdOf(next.views[viewId])
  const start = startNodeOf(payload)!
  const screens = Object.values(payload.nodes).filter((node) => node.role === 'process' && node.elementId && isScreenComponent(next, next.elements[node.elementId]))
  // Prefer a screen the person's C4 relationships reach, directly or through its container; else the only screen present.
  const reached = new Set(Object.values(next.relationships).filter((relationship) => relationship.sourceId === personId).flatMap((relationship) => [relationship.targetId, ...Object.values(relationship.viewEndpoints ?? {}).map((endpoints) => endpoints?.targetId ?? '')]))
  const target = screens.find((node) => reached.has(node.elementId!) || reached.has(next.elements[node.elementId!]?.parentId ?? '')) ?? (screens.length === 1 ? screens[0] : undefined)
  if (!target) return { project: next }
  if (!Object.values(payload.flows).some((flow) => flow.sourceNodeId === start.id && flow.targetNodeId === target.id)) next = createFlow(next, viewId, { sourceNodeId: start.id, targetNodeId: target.id, label: next.elements[personId]?.name ?? '' }).project
  return { project: next, node: target }
}

/** Promotes a derived relationship to a stored one and marks its member flows as carrying it (decision: dfd-drives-c4). */
export function materializeRelationship(project: Project, derived: Relationship): { project: Project; relationship: Relationship } {
  const created = createRelationship(project, { sourceId: derived.sourceId, targetId: derived.targetId, label: derived.label.split('\n')[0] ?? '', technology: derived.technology })
  let next = created.project
  ;(derived.derived?.members ?? []).forEach((member) => { next = patchFlow(next, member.viewId, member.flowId, { relationshipRef: created.relationship.id }) })
  return { project: next, relationship: created.relationship }
}

/** Imports a stored 1:1 component link as process -> API document -> process, the document handled by the passthrough component when the link went through one (requirement: c4-links-into-dfd). */
export function importLink(project: Project, viewId: string, link: ImportableLink): { project: Project; node?: DfdNode } {
  const linked = linkProcesses(project, viewId, link.sourceNodeId, link.targetNodeId, 'api_document', link.relationship.label || 'request')
  if (!linked.node) return { project }
  let next = linked.project
  const payload = dfdOf(next.views[viewId])
  Object.values(payload.flows).filter((flow) => flow.sourceNodeId === link.sourceNodeId && flow.targetNodeId === linked.node!.id || flow.sourceNodeId === linked.node!.id && flow.targetNodeId === link.targetNodeId).forEach((flow) => { next = patchFlow(next, viewId, flow.id, { relationshipRef: link.relationship.id, technology: link.relationship.technology ?? '' }) })
  if (link.viaElementId) next = patchNode(next, viewId, linked.node.id, { elementId: link.viaElementId })
  return { project: next, node: dfdOf(next.views[viewId]).nodes[linked.node.id] }
}

export { importableLinks }

export function createFlow(project: Project, viewId: string, input: { sourceNodeId: string; targetNodeId: string; label?: string; technology?: string; dataRefs?: string[]; operations?: DfdFlow['operations'] }): { project: Project; flow?: DfdFlow } {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind)) return { project }
  const payload = dfdOf(view)
  if (!payload.nodes[input.sourceNodeId] || !payload.nodes[input.targetNodeId] || input.sourceNodeId === input.targetNodeId) return { project }
  const flow: DfdFlow = { id: makeId('flow'), sourceNodeId: input.sourceNodeId, targetNodeId: input.targetNodeId, label: input.label ?? '', description: '', technology: input.technology ?? '', dataRefs: input.dataRefs ?? [], operations: input.operations ?? defaultOperations(payload, input) }
  return { project: upsertView(project, { ...view, dfd: { ...payload, flows: { ...payload.flows, [flow.id]: flow } } }), flow }
}

export function patchFlow(project: Project, viewId: string, flowId: string, patch: Partial<DfdFlow>): Project {
  return withDfd(project, viewId, (payload) => (payload.flows[flowId] ? { ...payload, flows: { ...payload.flows, [flowId]: { ...payload.flows[flowId], ...patch } } } : payload))
}

export function deleteFlow(project: Project, viewId: string, flowId: string): Project {
  return withDfd(project, viewId, (payload) => {
    const flows = { ...payload.flows }
    delete flows[flowId]
    const boundaries = Object.fromEntries(Object.entries(payload.boundaries).map(([id, boundary]) => [id, { ...boundary, flowIds: boundary.flowIds.filter((memberId) => memberId !== flowId) }]))
    return { ...payload, flows, boundaries }
  })
}

/** Inserts an intermediate node between two nodes and rewires the intended flow through it (rule: dfd-connection-policy). */
export function insertIntermediate(project: Project, viewId: string, sourceNodeId: string, targetNodeId: string, kind: IntermediateKind, name: string, position?: Position): { project: Project; node?: DfdNode } {
  const added = addFreeNode(project, viewId, { role: 'intermediate_data', name, intermediateKind: kind }, position)
  if (!added.node) return { project }
  let next = createFlow(added.project, viewId, { sourceNodeId, targetNodeId: added.node.id }).project
  next = createFlow(next, viewId, { sourceNodeId: added.node.id, targetNodeId }).project
  return { project: next, node: added.node }
}

// ---------- logical process groups (decision: dfd-logical-process-group) ----------

/** Creates a group from members (processes, groups, intermediate data), pulling them out of their current groups. */
export function groupMembers(project: Project, viewId: string, memberIds: string[], name = ''): { project: Project; group?: DfdGroup } {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind)) return { project }
  let payload = dfdOf(view)
  const members = memberIds.filter((id) => (payload.nodes[id] && payload.nodes[id].role !== 'external_entity' && payload.nodes[id].role !== 'data_store' && payload.nodes[id].role !== 'diagram_ref') || payload.groups[id])
  if (!members.length) return { project }
  const next = nextProcessNumber(payload)
  payload = next.payload
  const group: DfdGroup = { id: makeId('pgroup'), name, description: '', memberIds: members, processNumber: next.number }
  // The new group takes the place of its first member inside that member's parent group, if any.
  const parent = groupOf(payload, members[0])
  const groups = Object.fromEntries(Object.entries(payload.groups).map(([id, other]) => [id, { ...other, memberIds: other.memberIds.filter((memberId) => !members.includes(memberId)) }]))
  if (parent) groups[parent.id] = { ...groups[parent.id], memberIds: [...groups[parent.id].memberIds, group.id] }
  groups[group.id] = group
  return { project: upsertView(project, { ...view, dfd: { ...payload, groups } }), group }
}

export function addToGroup(project: Project, viewId: string, groupId: string, memberId: string): Project {
  return withDfd(project, viewId, (payload) => {
    if (!payload.groups[groupId] || memberId === groupId || descendantNodeIds(payload, memberId).includes(groupId)) return payload
    if (!payload.nodes[memberId] && !payload.groups[memberId]) return payload
    const groups = Object.fromEntries(Object.entries(payload.groups).map(([id, group]) => [id, { ...group, memberIds: group.memberIds.filter((other) => other !== memberId) }]))
    groups[groupId] = { ...groups[groupId], memberIds: [...groups[groupId].memberIds, memberId] }
    return { ...payload, groups }
  })
}

/** Moves a member to the level above its group; a process leaving to the top level gets a fresh number. */
export function removeFromGroup(project: Project, viewId: string, memberId: string): Project {
  const view = project.views[viewId]
  if (!view) return project
  let payload = dfdOf(view)
  const parent = groupOf(payload, memberId)
  if (!parent) return project
  const grandparent = groupOf(payload, parent.id)
  const groups = { ...payload.groups, [parent.id]: { ...parent, memberIds: parent.memberIds.filter((id) => id !== memberId) } }
  if (grandparent) groups[grandparent.id] = { ...grandparent, memberIds: [...grandparent.memberIds, memberId] }
  payload = { ...payload, groups }
  return upsertView(project, dissolveThinGroups({ ...view, dfd: payload }))
}

/** Dissolves a group: members return to the level above. */
export function ungroupMembers(project: Project, viewId: string, groupId: string): Project {
  const view = project.views[viewId]
  if (!view) return project
  return upsertView(project, dissolveThinGroups(ungroup(view, groupId)))
}

export function patchProcessGroup(project: Project, viewId: string, groupId: string, patch: Partial<DfdGroup>): Project {
  return withDfd(project, viewId, (payload) => (payload.groups[groupId] ? { ...payload, groups: { ...payload.groups, [groupId]: { ...payload.groups[groupId], ...patch } } } : payload))
}

/**
 * Collapses a group to one process at its representative's position, or expands it and shifts the members by
 * however far the collapsed box was dragged, so the picture stays where the author left it.
 */
export function setGroupCollapsed(project: Project, viewId: string, groupId: string, collapsed: boolean): Project {
  const view = project.views[viewId]
  const payload = view ? dfdOf(view) : undefined
  const group = payload?.groups[groupId]
  if (!view || !payload || !group) return project
  const current = new Set(view.layout.collapsedGroupIds ?? [])
  const representative = representativeOf(project, payload, group)
  const positions = { ...view.layout.positions }
  if (collapsed) {
    current.add(groupId)
    const anchor = representative ? positions[representative.id] : undefined
    if (anchor && !positions[groupId]) positions[groupId] = { ...anchor }
  } else {
    current.delete(groupId)
    const box = positions[groupId]
    const anchor = representative ? positions[representative.id] : undefined
    if (box && anchor) {
      const dx = box.x - anchor.x
      const dy = box.y - anchor.y
      if (dx || dy) descendantNodeIds(payload, groupId).forEach((id) => { if (positions[id]) positions[id] = { x: positions[id].x + dx, y: positions[id].y + dy } })
    }
    delete positions[groupId]
  }
  return upsertView(project, { ...view, layout: { ...view.layout, positions, collapsedGroupIds: [...current] } })
}

/**
 * Links two processes: they become (or join) one logical process group and an intermediate node of the chosen kind
 * is inserted between them, so the hop is process -> data -> process (rule: dfd-connection-policy).
 */
export function linkProcesses(project: Project, viewId: string, sourceNodeId: string, targetNodeId: string, kind: IntermediateKind, name: string, position?: Position): { project: Project; node?: DfdNode; group?: DfdGroup } {
  const inserted = insertIntermediate(project, viewId, sourceNodeId, targetNodeId, kind, name, position)
  if (!inserted.node) return { project }
  let next = inserted.project
  let payload = dfdOf(next.views[viewId])
  const sourceGroup = groupOf(payload, sourceNodeId)
  const targetGroup = groupOf(payload, targetNodeId)
  let group: DfdGroup | undefined
  if (!sourceGroup && !targetGroup) {
    const created = groupMembers(next, viewId, [sourceNodeId, inserted.node.id, targetNodeId])
    next = created.project
    group = created.group
  } else if (sourceGroup && targetGroup && sourceGroup.id !== targetGroup.id) {
    // Two groups joined merge into the source's group; the target group dissolves into it.
    next = addToGroup(next, viewId, sourceGroup.id, inserted.node.id)
    payload = dfdOf(next.views[viewId])
    const absorbed = payload.groups[targetGroup.id]
    if (absorbed) {
      const groups = { ...payload.groups }
      delete groups[targetGroup.id]
      Object.keys(groups).forEach((id) => { groups[id] = { ...groups[id], memberIds: groups[id].memberIds.filter((memberId) => memberId !== targetGroup.id) } })
      groups[sourceGroup.id] = { ...groups[sourceGroup.id], memberIds: [...groups[sourceGroup.id].memberIds, ...absorbed.memberIds] }
      const layout = next.views[viewId].layout
      next = upsertView(next, { ...next.views[viewId], dfd: { ...payload, groups }, layout: { ...layout, collapsedGroupIds: (layout.collapsedGroupIds ?? []).filter((id) => id !== targetGroup.id) } })
    }
    group = dfdOf(next.views[viewId]).groups[sourceGroup.id]
  } else {
    const host = sourceGroup ?? targetGroup!
    next = addToGroup(next, viewId, host.id, inserted.node.id)
    next = addToGroup(next, viewId, host.id, sourceGroup ? targetNodeId : sourceNodeId)
    group = dfdOf(next.views[viewId]).groups[host.id]
  }
  return { project: next, node: dfdOf(next.views[viewId]).nodes[inserted.node.id], group }
}

/** Inserts a free process between two data nodes (store to store never flows directly). */
export function insertProcess(project: Project, viewId: string, sourceNodeId: string, targetNodeId: string, name: string, position?: Position): { project: Project; node?: DfdNode } {
  const added = addFreeNode(project, viewId, { role: 'process', name }, position)
  if (!added.node) return { project }
  let next = createFlow(added.project, viewId, { sourceNodeId, targetNodeId: added.node.id }).project
  next = createFlow(next, viewId, { sourceNodeId: added.node.id, targetNodeId }).project
  return { project: next, node: added.node }
}

export function createBoundary(project: Project, viewId: string, name: string, flowIds: string[], consistency: Consistency = 'atomic'): { project: Project; boundary?: DfdBoundary } {
  const view = project.views[viewId]
  if (!view || !isDfdView(view.kind)) return { project }
  const payload = dfdOf(view)
  const boundary: DfdBoundary = { id: makeId('boundary'), name, description: '', consistency, flowIds: flowIds.filter((id) => payload.flows[id]) }
  return { project: upsertView(project, { ...view, dfd: { ...payload, boundaries: { ...payload.boundaries, [boundary.id]: boundary } } }), boundary }
}

export function patchBoundary(project: Project, viewId: string, boundaryId: string, patch: Partial<DfdBoundary>): Project {
  return withDfd(project, viewId, (payload) => (payload.boundaries[boundaryId] ? { ...payload, boundaries: { ...payload.boundaries, [boundaryId]: { ...payload.boundaries[boundaryId], ...patch } } } : payload))
}

export function deleteBoundary(project: Project, viewId: string, boundaryId: string): Project {
  return withDfd(project, viewId, (payload) => {
    const boundaries = { ...payload.boundaries }
    delete boundaries[boundaryId]
    return { ...payload, boundaries }
  })
}

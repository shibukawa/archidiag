import { dfdOf, groupChain, visibleIdOf } from './dfd'
import { BOUNDARY_PADDING, CANVAS_MARGIN_BOUNDARY, DEFAULT_BOUNDARY, dfdNodeSize, fitOuterBoundary, layeredLayout, nodeSize, nodeSizeFor, union } from './layout'
import { isDfdView, type DiagramView, type Position, type Project, type Rect } from './model'
import { projectRelationships, visibleElements } from './views'

export interface ArrangeResult { positions: Record<string, Position>; boundary?: Rect }

/**
 * Layered left-to-right layout for one view. Context elements that only send data start on the left and
 * those that only receive end on the right, so the picture lines up with the parent view. Sibling containers
 * sit between the scope boundary and the software system boundary; external elements sit outside both.
 */
export function arrangeView(project: Project, view: DiagramView, onlyIds?: Set<string>): ArrangeResult {
  if (isDfdView(view.kind)) return arrangeDfd(view, onlyIds)
  const { internal, siblings, external } = visibleElements(project, view)
  const all = [...internal, ...siblings, ...external]
  const relationships = projectRelationships(project, view, all)
  const size = nodeSize(view.displayMode)
  const sizeOf = (element: { id: string }) => nodeSizeFor(project.elements[element.id] ?? { id: element.id, kind: 'component', name: '', description: '', technology: '' }, view.displayMode, project)
  const contextIds = new Set([...siblings, ...external].map((element) => element.id))
  const roleOf = (id: string): 'source' | 'internal' | 'sink' => {
    if (!contextIds.has(id)) return 'internal'
    const outgoing = relationships.some((relationship) => relationship.sourceId === id)
    const incoming = relationships.some((relationship) => relationship.targetId === id)
    if (outgoing && !incoming) return 'source'
    if (incoming && !outgoing) return 'sink'
    return 'source'
  }
  const subject = onlyIds ? all.filter((element) => onlyIds.has(element.id)) : all
  const subjectIds = new Set(subject.map((element) => element.id))
  const laidOut = layeredLayout({
    nodes: subject.map((element) => ({ id: element.id, ...sizeOf(element), role: roleOf(element.id) })),
    edges: relationships.filter((relationship) => subjectIds.has(relationship.sourceId) && subjectIds.has(relationship.targetId)).map((relationship) => ({ sourceId: relationship.sourceId, targetId: relationship.targetId })),
  })
  if (onlyIds) {
    // Keep the selection where it was: translate the arranged block to the selection's old top-left.
    const old = union(subject.map((element) => ({ ...(view.layout.positions[element.id] ?? { x: 40, y: 40 }), ...sizeOf(element) })))
    const fresh = union(subject.map((element) => ({ ...laidOut[element.id], ...sizeOf(element) })))
    if (old && fresh) {
      const dx = old.x - fresh.x
      const dy = old.y - fresh.y
      Object.keys(laidOut).forEach((id) => { laidOut[id] = { x: laidOut[id].x + dx, y: laidOut[id].y + dy } })
    }
    return { positions: laidOut }
  }
  if (view.kind === 'c4_context') return { positions: laidOut }
  // Scope boundary around the internal nodes.
  const inner = union(internal.map((element) => ({ ...laidOut[element.id], ...sizeOf(element) })))
  const boundary: Rect = inner
    ? { x: inner.x - BOUNDARY_PADDING, y: inner.y - 40, width: inner.width + BOUNDARY_PADDING * 2, height: inner.height + 40 + 48 }
    : DEFAULT_BOUNDARY
  const gap = 48
  // Sibling containers go just outside the scope boundary, sources left and sinks right.
  siblings.forEach((element) => {
    const position = laidOut[element.id]
    laidOut[element.id] = roleOf(element.id) === 'sink'
      ? { x: Math.max(position.x, boundary.x + boundary.width + gap), y: position.y }
      : { x: Math.min(position.x, boundary.x - size.width - gap), y: position.y }
  })
  // External elements go outside the software system boundary when there is one.
  const outer = siblings.length || view.kind === 'c4_component' ? fitOuterBoundary(boundary, siblings.map((element) => ({ ...laidOut[element.id], ...size }))) : boundary
  external.forEach((element) => {
    const position = laidOut[element.id]
    laidOut[element.id] = roleOf(element.id) === 'sink'
      ? { x: Math.max(position.x, outer.x + outer.width + gap), y: position.y }
      : { x: Math.min(position.x, outer.x - size.width - gap), y: position.y }
  })
  const minOuterX = view.kind === 'c4_component' ? outer.x : boundary.x
  const minOuterY = view.kind === 'c4_component' ? outer.y : boundary.y
  const shiftX = Math.max(0, 40 - Math.min(...Object.values(laidOut).map((position) => position.x)), CANVAS_MARGIN_BOUNDARY - minOuterX)
  const shiftY = Math.max(0, 40 - Math.min(...Object.values(laidOut).map((position) => position.y)), CANVAS_MARGIN_BOUNDARY - minOuterY)
  if (shiftX || shiftY) {
    Object.keys(laidOut).forEach((id) => { laidOut[id] = { x: laidOut[id].x + shiftX, y: laidOut[id].y + shiftY } })
    boundary.x += shiftX
    boundary.y += shiftY
  }
  return { positions: laidOut, boundary }
}

/**
 * DFD layout (requirement: dfd-flow-direction): a compound layered layout, left to right from the start marker.
 * Expanded groups are laid out on their own and then placed as one block; cycles are broken by a depth-first walk
 * from the start so that only answers (return lanes) ever point left; a collapsed group is one node.
 */
function arrangeDfd(view: DiagramView, onlyIds?: Set<string>): ArrangeResult {
  const payload = dfdOf(view)
  const collapsed = new Set(view.layout.collapsedGroupIds ?? [])
  const GROUP_PAD = 20
  const GROUP_HEADER = 30
  const flows = Object.values(payload.flows).map((flow) => ({ sourceId: visibleIdOf(payload, flow.sourceNodeId, collapsed), targetId: visibleIdOf(payload, flow.targetNodeId, collapsed) })).filter((flow) => flow.sourceId !== flow.targetId)
  const isExpandedGroup = (id: string) => Boolean(payload.groups[id]) && !collapsed.has(id)
  /** The unit that contains a visible id at the level of parent: the next group down the chain, or the id itself. */
  const unitAtLevel = (id: string, parent: string | null): string => {
    const chain = groupChain(payload, id)
    if (parent === null) return chain[0] ?? id
    const index = chain.indexOf(parent)
    return index >= 0 ? chain[index + 1] ?? id : id
  }
  const membersOf = (parent: string | null): string[] => {
    if (parent === null) {
      const ids = [...Object.values(payload.nodes).filter((node) => visibleIdOf(payload, node.id, collapsed) === node.id).map((node) => node.id), ...Object.values(payload.groups).filter((group) => visibleIdOf(payload, group.id, collapsed) === group.id).map((group) => group.id)]
      return [...new Set(ids.map((id) => unitAtLevel(id, null)))]
    }
    const group = payload.groups[parent]
    return [...new Set(group.memberIds.map((id) => visibleIdOf(payload, id, collapsed)).map((id) => unitAtLevel(id, parent)))]
  }
  const roleOf = (id: string): 'source' | 'internal' | 'sink' => {
    const node = payload.nodes[id]
    if (node?.role === 'start') return 'source'
    if (node?.role !== 'external_entity') return 'internal'
    const outgoing = flows.some((flow) => flow.sourceId === id)
    const incoming = flows.some((flow) => flow.targetId === id)
    if (outgoing && !incoming) return 'source'
    if (incoming && !outgoing) return 'sink'
    return 'internal'
  }
  const laid: Record<string, Position> = {}
  /** Lays out the units of one level at origin (0,0) and returns the block size; group units recurse first. */
  const layoutLevel = (parent: string | null): { width: number; height: number; positions: Record<string, Position> } => {
    const units = membersOf(parent)
    const sizes = new Map<string, { width: number; height: number }>()
    const inner = new Map<string, Record<string, Position>>()
    units.forEach((id) => {
      if (isExpandedGroup(id)) {
        const block = layoutLevel(id)
        inner.set(id, block.positions)
        sizes.set(id, { width: block.width + GROUP_PAD * 2, height: block.height + GROUP_PAD + GROUP_HEADER })
      } else sizes.set(id, dfdNodeSize(payload.nodes[id]?.role ?? 'process', view.displayMode))
    })
    // Edges between units of this level; a flow's endpoints map to the units holding them.
    const unitSet = new Set(units)
    const toUnit = (id: string) => { const chain = groupChain(payload, id); if (parent === null) return chain[0] ?? id; const index = chain.indexOf(parent); return index >= 0 ? chain[index + 1] ?? id : undefined }
    const edges = flows.map((flow) => ({ sourceId: toUnit(flow.sourceId), targetId: toUnit(flow.targetId) })).filter((edge): edge is { sourceId: string; targetId: string } => Boolean(edge.sourceId && edge.targetId) && edge.sourceId !== edge.targetId && unitSet.has(edge.sourceId!) && unitSet.has(edge.targetId!))
    // Break cycles: a depth-first walk from the start and the sources marks the edges that close a loop as returns.
    const successors = new Map(units.map((id) => [id, edges.filter((edge) => edge.sourceId === id).map((edge) => edge.targetId)]))
    const state = new Map<string, 'open' | 'done'>()
    const back = new Set<string>()
    const walk = (id: string) => {
      state.set(id, 'open')
      successors.get(id)!.forEach((next) => {
        if (state.get(next) === 'open') back.add(`${id}->${next}`)
        else if (!state.has(next)) walk(next)
      })
      state.set(id, 'done')
    }
    const order = [...units.filter((id) => payload.nodes[id]?.role === 'start'), ...units.filter((id) => roleOf(id) === 'source'), ...units]
    order.forEach((id) => { if (!state.has(id)) walk(id) })
    // Topological order left to right; a table only read sits just before its reader, never at the far left.
    const forward = edges.filter((edge) => !back.has(`${edge.sourceId}->${edge.targetId}`))
    const positions = layeredLayout({ nodes: units.map((id) => ({ id, ...sizes.get(id)!, role: roleOf(id) })), edges: forward, spacing: { x: 110, y: 48 }, compactSources: true })
    const block = union(units.map((id) => ({ ...positions[id], ...sizes.get(id)! }))) ?? { x: 0, y: 0, width: 0, height: 0 }
    const normalized: Record<string, Position> = {}
    units.forEach((id) => { normalized[id] = { x: positions[id].x - block.x, y: positions[id].y - block.y } })
    // Members of an expanded group sit inside its block, below the header.
    units.filter((id) => isExpandedGroup(id)).forEach((id) => {
      const origin = normalized[id]
      Object.entries(inner.get(id)!).forEach(([memberId, position]) => { normalized[memberId] = { x: origin.x + GROUP_PAD + position.x, y: origin.y + GROUP_HEADER + position.y } })
    })
    return { width: block.width, height: block.height, positions: normalized }
  }
  const top = layoutLevel(null)
  Object.entries(top.positions).forEach(([id, position]) => { if (!payload.groups[id] || collapsed.has(id)) laid[id] = { x: 40 + Math.round(position.x), y: 40 + Math.round(position.y) } })
  if (onlyIds) {
    // Arrange the selection only: keep the block where the selection was.
    const subject = Object.keys(laid).filter((id) => onlyIds.has(id))
    const sizeOf = (id: string) => dfdNodeSize(payload.nodes[id]?.role ?? 'process', view.displayMode)
    const old = union(subject.map((id) => ({ ...(view.layout.positions[id] ?? { x: 40, y: 40 }), ...sizeOf(id) })))
    const fresh = union(subject.map((id) => ({ ...laid[id], ...sizeOf(id) })))
    const result: Record<string, Position> = {}
    subject.forEach((id) => { result[id] = old && fresh ? { x: laid[id].x + old.x - fresh.x, y: laid[id].y + old.y - fresh.y } : laid[id] })
    return { positions: result }
  }
  return { positions: laid }
}

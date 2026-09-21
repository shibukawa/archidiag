import { BOUNDARY_PADDING, CANVAS_MARGIN_BOUNDARY, DEFAULT_BOUNDARY, fitOuterBoundary, layeredLayout, nodeSize, nodeSizeFor, union } from './layout'
import type { DiagramView, Position, Project, Rect } from './model'
import { projectRelationships, visibleElements } from './views'

export interface ArrangeResult { positions: Record<string, Position>; boundary?: Rect }

/**
 * Layered left-to-right layout for one view. Context elements that only send data start on the left and
 * those that only receive end on the right, so the picture lines up with the parent view. Sibling containers
 * sit between the scope boundary and the software system boundary; external elements sit outside both.
 */
export function arrangeView(project: Project, view: DiagramView, onlyIds?: Set<string>): ArrangeResult {
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

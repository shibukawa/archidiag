import { allRelationships } from './dfd'
import {
  ancestorIds,
  childrenOf,
  childViewKind,
  isDfdView,
  LEVEL_BY_VIEW_KIND,
  makeId,
  type DiagramView,
  type Element,
  type Project,
  type Relationship,
  type ViewKind,
} from './model'

export interface ProjectedRelationship extends Relationship {
  /** True when an endpoint was promoted to a visible ancestor. */
  projected: boolean
  /** Set when one endpoint is the scope element itself: the edge attaches to the scope boundary until it is assigned to a child. */
  boundaryEnd?: 'source' | 'target'
  /** Every relationship id folded into this edge; one line is drawn per visible pair and direction. */
  mergedIds: string[]
  originalSourceId: string
  originalTargetId: string
}

export function viewsForScope(project: Project, kind: ViewKind, scopeId: string | null): DiagramView[] {
  return Object.values(project.views)
    .filter((view) => view.kind === kind && view.scopeId === scopeId)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
}

export function defaultView(project: Project, kind: ViewKind, scopeId: string | null): DiagramView | undefined {
  const views = viewsForScope(project, kind, scopeId)
  return views.find((view) => view.isDefault) ?? views[0]
}

export function makeView(kind: ViewKind, scopeId: string | null, name: string, isDefault: boolean): DiagramView {
  return { id: makeId('view'), kind, scopeId, name, description: '', isDefault, elementRefs: [], displayMode: 'descriptive', layout: { positions: {} } }
}

/** Returns the project with a default view for the scope, creating one when absent. */
export function ensureDefaultView(project: Project, kind: ViewKind, scopeId: string | null): { project: Project; view: DiagramView } {
  const existing = defaultView(project, kind, scopeId)
  if (existing) return { project, view: existing }
  const view = makeView(kind, scopeId, '', true)
  return { project: { ...project, views: { ...project.views, [view.id]: view } }, view }
}

/** Elements that belong to the view's scope (children), filtered by elementRefs when set. */
export function scopeElements(project: Project, view: DiagramView): Element[] {
  if (isDfdView(view.kind)) return []
  const children = childrenOf(project, view.scopeId)
  if (!view.elementRefs.length) return children
  const allowed = new Set(view.elementRefs)
  return children.filter((element) => allowed.has(element.id))
}

export interface VisibleElements {
  /** Children of the scope shown in this view. */
  internal: Element[]
  /** Component views only: other containers of the same software system that talk to the visible components. */
  siblings: Element[]
  /** Root elements outside the scope's software system that talk to the visible elements. */
  external: Element[]
}

function descendantsOf(project: Project, ids: Iterable<string>): Set<string> {
  const result = new Set<string>()
  const collect = (id: string) => {
    childrenOf(project, id).forEach((child) => {
      result.add(child.id)
      collect(child.id)
    })
  }
  for (const id of ids) collect(id)
  return result
}

/**
 * Scope children plus context: sibling containers (component views) and root elements that have a
 * relationship reaching a visible element or one of its descendants. Container views also keep root
 * elements whose relationship stops at the owning system when the view shows every container.
 */
export function visibleElements(project: Project, view: DiagramView): VisibleElements {
  // DFD views draw their own nodes (data:dfd-model), never the scope's children directly.
  if (isDfdView(view.kind)) return { internal: [], siblings: [], external: [] }
  const internal = scopeElements(project, view)
  // ERD views show the data store's entities only; readers and writers of the store are a DFD concern.
  if (view.kind === 'c4_context' || view.kind === 'erd_component') return { internal, siblings: [], external: [] }
  if (view.kind === 'erd_code') {
    // The owner entity is drawn inside its own view with its dependents; other entities it relates to sit outside as context.
    const owner = view.scopeId ? project.elements[view.scopeId] : undefined
    const inside = owner ? [owner, ...internal] : internal
    const insideIds = new Set(inside.map((element) => element.id))
    const relationships = Object.values(project.relationships)
    const external = Object.values(project.elements).filter((element) => element.kind === 'entity' && !insideIds.has(element.id)
      && relationships.some((relationship) => (relationship.sourceId === element.id && insideIds.has(relationship.targetId)) || (relationship.targetId === element.id && insideIds.has(relationship.sourceId))))
    return { internal: inside, siblings: [], external }
  }
  const internalIds = new Set(internal.map((element) => element.id))
  const ancestors = ancestorIds(project, view.scopeId)
  const ownerIds = new Set(ancestors)
  const internalReach = descendantsOf(project, internalIds)
  internalIds.forEach((id) => internalReach.add(id))
  const level = LEVEL_BY_VIEW_KIND[view.kind]
  // Stored relationships plus those derived from DFD flows (decision: dfd-drives-c4).
  const relationships = Object.values(allRelationships(project))
  const reaches = (candidateIds: Set<string>, allowOwner: boolean) => relationships.some((relationship) => {
    const endpoints = endpointsFor(relationship, level)
    const sourceId = endpoints?.sourceId ?? relationship.sourceId
    const targetId = endpoints?.targetId ?? relationship.targetId
    const mine = candidateIds.has(sourceId) ? targetId : candidateIds.has(targetId) ? sourceId : undefined
    if (!mine) return false
    if (internalReach.has(mine)) return true
    // A relationship that stops at the scope element itself still brings its other end into the view;
    // the edge then attaches to the scope boundary until it is assigned to a child (rule: boundary attachment).
    return allowOwner && mine === view.scopeId
  })
  const scope = view.scopeId ? project.elements[view.scopeId] : undefined
  // Component views: a relationship that names a component of a sibling container brings that component in as external
  // context (drawn under its container's name); one that stops at the container brings the container (decision: dfd-drives-c4).
  const siblings: Element[] = []
  if (view.kind === 'c4_component' && scope?.parentId) {
    childrenOf(project, scope.parentId).filter((element) => element.id !== scope.id).forEach((container) => {
      const components = childrenOf(project, container.id).filter((component) => component.kind === 'component' && reaches(new Set([component.id]), true))
      siblings.push(...components)
      const ids = descendantsOf(project, [container.id])
      ids.add(container.id)
      const componentIds = new Set(components.map((component) => component.id))
      const containerOnly = relationships.some((relationship) => {
        const endpoints = endpointsFor(relationship, level)
        const sourceId = endpoints?.sourceId ?? relationship.sourceId
        const targetId = endpoints?.targetId ?? relationship.targetId
        const mine = ids.has(sourceId) ? { end: sourceId, other: targetId } : ids.has(targetId) ? { end: targetId, other: sourceId } : undefined
        if (!mine || componentIds.has(mine.end)) return false
        return internalReach.has(mine.other) || mine.other === view.scopeId
      })
      if (containerOnly) siblings.push(container)
    })
  }
  const external = Object.values(project.elements).filter((element) => {
    if (element.parentId || ownerIds.has(element.id)) return false
    const ids = descendantsOf(project, [element.id])
    ids.add(element.id)
    return reaches(ids, true)
  })
  return { internal, siblings, external }
}

/** The most specific per-level endpoint mapping at or above this level; component views inherit container mappings. */
function endpointsFor(relationship: Relationship, level: 'container' | 'component' | 'context') {
  if (level === 'context') return undefined
  if (level === 'component') return relationship.viewEndpoints?.component ?? relationship.viewEndpoints?.container
  return relationship.viewEndpoints?.container
}

function resolveVisibleEndpoint(project: Project, id: string, visibleIds: Set<string>) {
  if (visibleIds.has(id)) return id
  let element = project.elements[id]
  while (element?.parentId) {
    if (visibleIds.has(element.parentId)) return element.parentId
    element = project.elements[element.parentId]
  }
  return undefined
}

/** Relationships between visible elements, with hidden endpoints promoted to their nearest visible ancestor. */
export function projectRelationships(project: Project, view: DiagramView, visible: Element[]): ProjectedRelationship[] {
  const ids = new Set(visible.map((element) => element.id))
  // The scope element resolves too, so relationships that stop at it attach to the boundary instead of vanishing.
  const withScope = new Set(ids)
  if (view.scopeId) withScope.add(view.scopeId)
  const level = LEVEL_BY_VIEW_KIND[view.kind]
  const projected = Object.values(allRelationships(project)).flatMap((relationship) => {
    const endpoints = endpointsFor(relationship, level)
    const sourceId = endpoints?.sourceId ?? relationship.sourceId
    const targetId = endpoints?.targetId ?? relationship.targetId
    const visibleSource = resolveVisibleEndpoint(project, sourceId, withScope)
    const visibleTarget = resolveVisibleEndpoint(project, targetId, withScope)
    if (!visibleSource || !visibleTarget || visibleSource === visibleTarget) return []
    // erd_code draws the scope entity as a node, so a relationship reaching it is an ordinary edge, not a boundary edge.
    const scopeVisible = Boolean(view.scopeId && ids.has(view.scopeId))
    const sourceIsScope = !scopeVisible && visibleSource === view.scopeId
    const targetIsScope = !scopeVisible && visibleTarget === view.scopeId
    if (sourceIsScope && targetIsScope) return []
    return [{
      ...relationship,
      sourceId: visibleSource,
      targetId: visibleTarget,
      projected: !sourceIsScope && !targetIsScope && (visibleSource !== sourceId || visibleTarget !== targetId),
      boundaryEnd: sourceIsScope ? 'source' as const : targetIsScope ? 'target' as const : undefined,
      mergedIds: [relationship.id],
      originalSourceId: sourceId,
      originalTargetId: targetId,
    }]
  })
  // A promoted (projected) relationship is a detail of a direct one between the same visible pair: keep the direct one only.
  const directPairs = new Set(projected.filter((relationship) => !relationship.projected).map((relationship) => `${relationship.sourceId}->${relationship.targetId}`))
  const kept = projected.filter((relationship) => {
    if (relationship.projected && directPairs.has(`${relationship.sourceId}->${relationship.targetId}`)) return false
    // A boundary-attached relationship is redundant when the same relationship id already reaches a visible child via mapping.
    if (relationship.boundaryEnd && projected.some((other) => other !== relationship && other.id === relationship.id && !other.boundaryEnd)) return false
    return true
  })
  // ERD views keep one line per relationship: each carries its own multiplicity ends.
  if (view.kind === 'erd_component' || view.kind === 'erd_code') return kept
  // One edge per visible pair and direction: labels and technologies are folded together, one per line.
  const byPair = new Map<string, ProjectedRelationship[]>()
  kept.forEach((relationship) => {
    const pair = `${relationship.sourceId}->${relationship.targetId}`
    byPair.set(pair, [...(byPair.get(pair) ?? []), relationship])
  })
  return [...byPair.values()].map((group) => {
    const first = group[0]
    const labels = [...new Set(group.map((relationship) => relationship.label.trim()).filter(Boolean))]
    const technologies = [...new Set(group.map((relationship) => relationship.technology?.trim() ?? '').filter(Boolean))]
    return {
      ...first,
      label: labels.join('\n'),
      technology: technologies.join(' / ') || undefined,
      projected: group.every((relationship) => relationship.projected),
      mergedIds: group.map((relationship) => relationship.id),
    }
  })
}

export interface Crumb { label: string; kind: ViewKind; scopeId: string | null; viewId?: string }

/** The C4 chain down to the view's scope; a DFD adds itself as the last crumb so the paired C4 view is one click up. */
export function breadcrumb(project: Project, view: DiagramView, rootLabel: string, dfdLabel?: string): Crumb[] {
  const trail: Crumb[] = [{ label: rootLabel, kind: 'c4_context', scopeId: null }]
  const chain = ancestorIds(project, view.scopeId).reverse()
  chain.forEach((id) => {
    const element = project.elements[id]
    const kind = childViewKind(element)
    if (kind) trail.push({ label: element.name, kind, scopeId: id })
  })
  if (isDfdView(view.kind)) trail.push({ label: dfdLabel ?? view.useCase ?? view.name, kind: view.kind, scopeId: view.scopeId, viewId: view.id })
  return trail
}

export function scopeLabel(project: Project, view: DiagramView, rootLabel: string) {
  if (!view.scopeId) return rootLabel
  return project.elements[view.scopeId]?.name ?? rootLabel
}

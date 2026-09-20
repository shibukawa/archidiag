// Pure project commands. Each returns a new project; the UI wraps them in history.
import { makeId, type DiagramView, type Element, type Group, type Position, type Project, type Rect, type Relationship, type ViewKind } from './model'
import { makeView } from './views'

export function upsertElement(project: Project, element: Element): Project {
  return { ...project, elements: { ...project.elements, [element.id]: element } }
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
      layout: { ...view.layout, positions: Object.fromEntries(Object.entries(view.layout.positions).filter(([ref]) => !toDelete.has(ref))) },
    }]))
  return { project: { ...project, elements, relationships, groups, views }, deletedIds: [...toDelete] }
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

import { childViewKind, effectiveCategory, LEVEL_BY_VIEW_KIND, SQL_STORE_KINDS, type Element, type ElementKind, type Project, type ViewKind } from './model'

export type Level = 'error' | 'warning' | 'info' | 'off'

export interface Finding {
  itemId: string
  level: Exclude<Level, 'off'>
  targetKind: 'element' | 'relationship' | 'view' | 'group' | 'project'
  targetId: string
  message: string
  /** View to open when navigating to the finding, when known. */
  viewId?: string
}

export interface CheckItem {
  id: string
  family: 'c4' | 'layout' | 'integrity'
  title: string
  defaultLevel: Level
}

export interface CheckProfile {
  id: string
  name: string
  extends?: string
  itemLevels: Record<string, Level>
}

export const CHECK_ITEMS: CheckItem[] = [
  { id: 'c4.element_has_description', family: 'c4', title: 'Element has a description', defaultLevel: 'warning' },
  { id: 'c4.container_has_technology', family: 'c4', title: 'Container names its technology', defaultLevel: 'warning' },
  { id: 'c4.component_has_technology', family: 'c4', title: 'Component names its technology', defaultLevel: 'info' },
  { id: 'c4.software_system_has_container_view', family: 'c4', title: 'Software system has a Container view', defaultLevel: 'info' },
  { id: 'c4.application_container_has_component_view', family: 'c4', title: 'Application container has a Component view', defaultLevel: 'info' },
  { id: 'c4.relationship_has_label', family: 'c4', title: 'Relationship has a label', defaultLevel: 'warning' },
  { id: 'c4.relationship_has_technology', family: 'c4', title: 'Relationship names its technology', defaultLevel: 'info' },
  { id: 'c4.element_in_some_view', family: 'c4', title: 'Element appears in at least one view of its scope', defaultLevel: 'info' },
  { id: 'c4.element_has_relationship', family: 'c4', title: 'Element is connected to something', defaultLevel: 'info' },
  { id: 'c4.data_store_has_dialect', family: 'c4', title: 'Database container selects a SQL dialect', defaultLevel: 'info' },
  { id: 'c4.relationship_assigned_in_child_view', family: 'c4', title: 'Relationship to a system or container is assigned to a child in its child view', defaultLevel: 'warning' },
]

export const CHECK_PROFILES: CheckProfile[] = [
  { id: 'context_sketch', name: 'Context sketch', itemLevels: Object.fromEntries(CHECK_ITEMS.map((item) => [item.id, 'off' as Level])) },
  { id: 'container_sketch', name: 'Container sketch', extends: 'context_sketch', itemLevels: { 'c4.container_has_technology': 'warning', 'c4.relationship_has_label': 'warning', 'c4.relationship_assigned_in_child_view': 'warning', 'c4.data_store_has_dialect': 'info' } },
  { id: 'component_complete', name: 'Component complete', extends: 'container_sketch', itemLevels: { 'c4.element_has_description': 'warning', 'c4.application_container_has_component_view': 'warning', 'c4.software_system_has_container_view': 'warning', 'c4.component_has_technology': 'info', 'c4.relationship_has_technology': 'info', 'c4.element_in_some_view': 'info', 'c4.element_has_relationship': 'info' } },
  { id: 'export_ready', name: 'Export ready', extends: 'component_complete', itemLevels: { 'c4.element_has_description': 'error', 'c4.container_has_technology': 'error', 'c4.relationship_has_label': 'error', 'c4.relationship_assigned_in_child_view': 'error', 'c4.application_container_has_component_view': 'warning', 'c4.software_system_has_container_view': 'warning', 'c4.data_store_has_dialect': 'warning' } },
]

export function resolveLevel(profileId: string, itemId: string): Level {
  const byId = new Map(CHECK_PROFILES.map((profile) => [profile.id, profile]))
  const visited = new Set<string>()
  let current = byId.get(profileId)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const level = current.itemLevels[itemId]
    if (level) return level
    current = current.extends ? byId.get(current.extends) : undefined
  }
  return CHECK_ITEMS.find((item) => item.id === itemId)?.defaultLevel ?? 'off'
}

const VALID_PARENT: Record<ElementKind, ElementKind[] | null> = {
  person: null,
  softwareSystem: null,
  externalSystem: null,
  container: ['softwareSystem'],
  component: ['container'],
}

/** Fixed integrity rules; these are always errors and cannot be turned off. */
export function integrityFindings(project: Project): Finding[] {
  const findings: Finding[] = []
  const elements = Object.values(project.elements)
  elements.forEach((element) => {
    if (!element.name.trim()) findings.push({ itemId: 'integrity.element_name', level: 'error', targetKind: 'element', targetId: element.id, message: 'Element has no name' })
    const allowed = VALID_PARENT[element.kind]
    if (allowed === null && element.parentId) findings.push({ itemId: 'integrity.parent', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.kind} cannot have a parent` })
    if (allowed) {
      const parent = element.parentId ? project.elements[element.parentId] : undefined
      if (!parent || !allowed.includes(parent.kind)) findings.push({ itemId: 'integrity.parent', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.kind} needs a ${allowed.join(' or ')} parent` })
      else if (parent.kind === 'container' && effectiveCategory(parent) !== 'application') findings.push({ itemId: 'integrity.parent', level: 'error', targetKind: 'element', targetId: element.id, message: 'Components belong to application containers only' })
    }
    if (element.kind === 'container' && effectiveCategory(element) === 'dataStore' && !element.dataStoreKind) findings.push({ itemId: 'integrity.data_store_kind', level: 'error', targetKind: 'element', targetId: element.id, message: 'Data store container needs a data store kind' })
    if (element.groupId) {
      const group = project.groups[element.groupId]
      if (!group) findings.push({ itemId: 'integrity.group', level: 'error', targetKind: 'element', targetId: element.id, message: 'Group does not exist' })
      else if ((group.scopeId ?? null) !== (element.parentId ?? null)) findings.push({ itemId: 'integrity.group', level: 'error', targetKind: 'element', targetId: element.id, message: 'Group belongs to a different scope' })
    }
  })
  Object.values(project.relationships).forEach((relationship) => {
    if (!project.elements[relationship.sourceId] || !project.elements[relationship.targetId]) findings.push({ itemId: 'integrity.endpoint', level: 'error', targetKind: 'relationship', targetId: relationship.id, message: 'Relationship endpoint does not resolve' })
    if (relationship.sourceId === relationship.targetId) findings.push({ itemId: 'integrity.self_relationship', level: 'error', targetKind: 'relationship', targetId: relationship.id, message: 'Relationship connects an element to itself' })
  })
  Object.values(project.groups).forEach((group) => {
    let current = group.parentGroupId
    const seen = new Set([group.id])
    while (current) {
      if (seen.has(current)) { findings.push({ itemId: 'integrity.group_cycle', level: 'error', targetKind: 'group', targetId: group.id, message: 'Group nesting forms a cycle' }); break }
      seen.add(current)
      const parent = project.groups[current]
      if (!parent) { findings.push({ itemId: 'integrity.group_parent', level: 'error', targetKind: 'group', targetId: group.id, message: 'Parent group does not exist' }); break }
      if ((parent.scopeId ?? null) !== (group.scopeId ?? null)) findings.push({ itemId: 'integrity.group_parent', level: 'error', targetKind: 'group', targetId: group.id, message: 'Nested group belongs to a different scope' })
      current = parent.parentGroupId
    }
  })
  const defaults = new Map<string, number>()
  Object.values(project.views).forEach((view) => {
    const scope = view.scopeId ? project.elements[view.scopeId] : undefined
    const expectedKind: ViewKind | undefined = view.scopeId ? (scope ? childViewKind(scope) : undefined) : 'c4_context'
    if (expectedKind !== view.kind) findings.push({ itemId: 'integrity.view_scope', level: 'error', targetKind: 'view', targetId: view.id, message: `View kind ${view.kind} does not match its scope`, viewId: view.id })
    view.elementRefs.forEach((id) => {
      const element = project.elements[id]
      if (!element || (element.parentId ?? null) !== (view.scopeId ?? null)) findings.push({ itemId: 'integrity.view_ref', level: 'error', targetKind: 'view', targetId: view.id, message: `View references ${id} outside its scope`, viewId: view.id })
    })
    if (view.isDefault) {
      const key = `${view.kind}:${view.scopeId ?? 'root'}`
      defaults.set(key, (defaults.get(key) ?? 0) + 1)
    }
  })
  defaults.forEach((count, key) => {
    if (count > 1) findings.push({ itemId: 'integrity.default_view', level: 'error', targetKind: 'project', targetId: key, message: `More than one default view for ${key}` })
  })
  return findings
}

export function checkFindings(project: Project, profileId = project.settings.checkProfile): Finding[] {
  const findings: Finding[] = []
  const emit = (itemId: string, targetKind: Finding['targetKind'], targetId: string, message: string, viewId?: string) => {
    const level = resolveLevel(profileId, itemId)
    if (level === 'off') return
    findings.push({ itemId, level, targetKind, targetId, message, viewId })
  }
  const elements = Object.values(project.elements)
  const relationships = Object.values(project.relationships)
  const views = Object.values(project.views)
  const viewFor = (element: Element) => views.find((view) => view.scopeId === (element.parentId ?? null) && view.isDefault)?.id
  elements.forEach((element) => {
    if (!element.description.trim()) emit('c4.element_has_description', 'element', element.id, `${element.name}: no description`, viewFor(element))
    if (element.kind === 'container' && !element.technology.trim()) emit('c4.container_has_technology', 'element', element.id, `${element.name}: no technology`, viewFor(element))
    if (element.kind === 'component' && !element.technology.trim()) emit('c4.component_has_technology', 'element', element.id, `${element.name}: no technology`, viewFor(element))
    if (element.kind === 'softwareSystem' && !views.some((view) => view.kind === 'c4_container' && view.scopeId === element.id)) emit('c4.software_system_has_container_view', 'element', element.id, `${element.name}: no Container view`, viewFor(element))
    if (element.kind === 'container' && effectiveCategory(element) === 'application' && !views.some((view) => view.kind === 'c4_component' && view.scopeId === element.id)) emit('c4.application_container_has_component_view', 'element', element.id, `${element.name}: no Component view`, viewFor(element))
    if (element.kind === 'container' && effectiveCategory(element) === 'dataStore' && element.dataStoreKind && SQL_STORE_KINDS.includes(element.dataStoreKind) && !element.sqlDialect) emit('c4.data_store_has_dialect', 'element', element.id, `${element.name}: no SQL dialect`, viewFor(element))
    const scopeViews = views.filter((view) => view.scopeId === (element.parentId ?? null) && view.kind === LEVEL_TO_KIND[element.kind])
    if (scopeViews.length && !scopeViews.some((view) => !view.elementRefs.length || view.elementRefs.includes(element.id))) emit('c4.element_in_some_view', 'element', element.id, `${element.name}: hidden from every view`, scopeViews[0].id)
    if (!relationships.some((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id)) emit('c4.element_has_relationship', 'element', element.id, `${element.name}: no relationships`, viewFor(element))
  })
  relationships.forEach((relationship) => {
    // A relationship ending at a system or application container should name the child it reaches once that child view exists.
    ;(['sourceId', 'targetId'] as const).forEach((side) => {
      const endpoint = project.elements[relationship[side]]
      const childKind = endpoint ? childViewKind(endpoint) : undefined
      if (!endpoint || !childKind) return
      const childView = views.find((view) => view.kind === childKind && view.scopeId === endpoint.id)
      if (!childView) return
      const level = LEVEL_BY_VIEW_KIND[childKind]
      const mapped = relationship.viewEndpoints?.[level]?.[side]
      if (!mapped || mapped === endpoint.id) emit('c4.relationship_assigned_in_child_view', 'relationship', relationship.id, `${project.elements[relationship.sourceId]?.name ?? '?'} → ${project.elements[relationship.targetId]?.name ?? '?'}: not assigned to a child of ${endpoint.name}`, childView.id)
    })
    const source = project.elements[relationship.sourceId]
    if (!relationship.label.trim()) emit('c4.relationship_has_label', 'relationship', relationship.id, `${source?.name ?? relationship.sourceId} → ${project.elements[relationship.targetId]?.name ?? relationship.targetId}: no label`, source ? viewFor(source) : undefined)
    if (!relationship.technology?.trim()) emit('c4.relationship_has_technology', 'relationship', relationship.id, `${source?.name ?? relationship.sourceId} → ${project.elements[relationship.targetId]?.name ?? relationship.targetId}: no technology`, source ? viewFor(source) : undefined)
  })
  return findings
}

const LEVEL_TO_KIND: Record<ElementKind, ViewKind> = {
  person: 'c4_context',
  softwareSystem: 'c4_context',
  externalSystem: 'c4_context',
  container: 'c4_container',
  component: 'c4_component',
}

export function allFindings(project: Project): Finding[] {
  const order: Record<Finding['level'], number> = { error: 0, warning: 1, info: 2 }
  return [...integrityFindings(project), ...checkFindings(project)].sort((a, b) => order[a.level] - order[b.level])
}

export { LEVEL_BY_VIEW_KIND }

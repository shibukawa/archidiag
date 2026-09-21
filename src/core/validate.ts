import { childViewKind, effectiveCategory, isErdRelationship, isErdStore, isErdView, isViewStorage, LEVEL_BY_VIEW_KIND, scopeViewKindFor, SQL_STORE_KINDS, storeOf, type Element, type ElementKind, type Project, type ViewKind } from './model'

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
  family: 'c4' | 'erd' | 'layout' | 'integrity'
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
  { id: 'erd.data_store_has_entities', family: 'erd', title: 'Database container has at least one entity', defaultLevel: 'info' },
  { id: 'erd.entity_has_attributes', family: 'erd', title: 'Entity has at least one field', defaultLevel: 'warning' },
  { id: 'erd.entity_has_primary_key', family: 'erd', title: 'Entity has a primary key', defaultLevel: 'warning' },
  { id: 'erd.entity_has_visible_attribute', family: 'erd', title: 'Entity marks at least one field as important', defaultLevel: 'info' },
  { id: 'erd.entity_has_classification', family: 'erd', title: 'Entity has a classification', defaultLevel: 'info' },
  { id: 'erd.event_has_timestamp', family: 'erd', title: 'Event entity records when it happened', defaultLevel: 'info' },
  { id: 'erd.entity_has_volume', family: 'erd', title: 'Entity states its bytes per row', defaultLevel: 'info' },
  { id: 'erd.rebuild_without_initial_rows', family: 'erd', title: 'Rebuilt table states its row count', defaultLevel: 'info' },
]

/** Field names that read as a point in time, in English or Japanese. */
const TIMESTAMP_NAME = /(_at|_on|date|time|timestamp|日時|日付|時刻)$/i

export const CHECK_PROFILES: CheckProfile[] = [
  { id: 'context_sketch', name: 'Context sketch', itemLevels: Object.fromEntries(CHECK_ITEMS.map((item) => [item.id, 'off' as Level])) },
  { id: 'container_sketch', name: 'Container sketch', extends: 'context_sketch', itemLevels: { 'c4.container_has_technology': 'warning', 'c4.relationship_has_label': 'warning', 'c4.relationship_assigned_in_child_view': 'warning', 'c4.data_store_has_dialect': 'info' } },
  { id: 'component_complete', name: 'Component complete', extends: 'container_sketch', itemLevels: { 'c4.element_has_description': 'warning', 'c4.application_container_has_component_view': 'warning', 'c4.software_system_has_container_view': 'warning', 'c4.component_has_technology': 'info', 'c4.relationship_has_technology': 'info', 'c4.element_in_some_view': 'info', 'c4.element_has_relationship': 'info', 'erd.data_store_has_entities': 'info', 'erd.entity_has_attributes': 'warning', 'erd.entity_has_primary_key': 'warning', 'erd.entity_has_visible_attribute': 'info', 'erd.entity_has_classification': 'info', 'erd.event_has_timestamp': 'warning' } },
  { id: 'export_ready', name: 'Export ready', extends: 'component_complete', itemLevels: { 'c4.element_has_description': 'error', 'c4.container_has_technology': 'error', 'c4.relationship_has_label': 'error', 'c4.relationship_assigned_in_child_view': 'error', 'c4.application_container_has_component_view': 'warning', 'c4.software_system_has_container_view': 'warning', 'c4.data_store_has_dialect': 'warning', 'erd.entity_has_attributes': 'error', 'erd.entity_has_primary_key': 'error', 'erd.entity_has_visible_attribute': 'warning', 'erd.entity_has_classification': 'warning', 'erd.event_has_timestamp': 'warning' } },
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
  entity: ['container', 'entity'],
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
      else if (element.kind === 'component' && parent.kind === 'container' && effectiveCategory(parent) !== 'application') findings.push({ itemId: 'integrity.parent', level: 'error', targetKind: 'element', targetId: element.id, message: 'Components belong to application containers only' })
      else if (element.kind === 'entity' && !storeOf(project, element)) findings.push({ itemId: 'integrity.parent', level: 'error', targetKind: 'element', targetId: element.id, message: 'Entities belong to database or database schema containers, directly or under an owner entity' })
      else if (element.kind === 'entity' && parent.kind === 'entity') {
        // rule: erd-scope-integrity. A dependent entity is named by exactly one dependent relationship from its owner.
        const owners = Object.values(project.relationships).filter((relationship) => relationship.erd?.kind === 'dependent' && relationship.targetId === element.id)
        if (owners.length !== 1 || owners[0].sourceId !== parent.id) findings.push({ itemId: 'integrity.dependent_owner', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.name}: a dependent entity needs exactly one dependent relationship from ${parent.name}` })
      }
    }
    if (element.kind === 'entity') {
      const names = new Set<string>()
      ;(element.attributes ?? []).forEach((attribute) => {
        const key = attribute.name.trim().toLowerCase()
        if (!key) findings.push({ itemId: 'integrity.attribute_name', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.name}: a field has no name` })
        else if (names.has(key)) findings.push({ itemId: 'integrity.attribute_name', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.name}: duplicate field ${attribute.name}` })
        names.add(key)
      })
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
    // rule: erd-scope-integrity. Entities relate only to entities of the same data store; readers and writers are DFD flows.
    const source = project.elements[relationship.sourceId]
    const target = project.elements[relationship.targetId]
    if (source && target && (source.kind === 'entity' || target.kind === 'entity')) {
      if (source.kind !== target.kind) findings.push({ itemId: 'integrity.erd_endpoint', level: 'error', targetKind: 'relationship', targetId: relationship.id, message: `${source.name} → ${target.name}: an entity relates only to another entity` })
      else if (storeOf(project, source)?.id !== storeOf(project, target)?.id) findings.push({ itemId: 'integrity.erd_scope', level: 'error', targetKind: 'relationship', targetId: relationship.id, message: `${source.name} → ${target.name}: entities of different data stores cannot relate` })
      else if (relationship.erd?.kind === 'dependent' && target.parentId !== source.id) findings.push({ itemId: 'integrity.dependent_owner', level: 'error', targetKind: 'relationship', targetId: relationship.id, message: `${source.name} → ${target.name}: a dependent relationship must point at an entity owned by its source` })
    }
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
    if (isErdStore(element) && !elements.some((child) => child.kind === 'entity' && child.parentId === element.id)) emit('erd.data_store_has_entities', 'element', element.id, `${element.name}: no entities`, viewFor(element))
    if (element.kind === 'entity') {
      const attributes = element.attributes ?? []
      if (!attributes.length) emit('erd.entity_has_attributes', 'element', element.id, `${element.name}: no fields`, viewFor(element))
      else {
        // Views have no primary key of their own.
        if (!isViewStorage(element) && !attributes.some((attribute) => attribute.primaryKey)) emit('erd.entity_has_primary_key', 'element', element.id, `${element.name}: no primary key`, viewFor(element))
        if (!attributes.some((attribute) => attribute.important)) emit('erd.entity_has_visible_attribute', 'element', element.id, `${element.name}: no field is marked important, so the card shows none`, viewFor(element))
      }
      if (!element.classification) emit('erd.entity_has_classification', 'element', element.id, `${element.name}: no classification`, viewFor(element))
      // T-style ER: an event is something that happened, so it carries a date or time field.
      if (element.classification === 'event' && attributes.length && !attributes.some((attribute) => TIMESTAMP_NAME.test(attribute.name.trim()))) emit('erd.event_has_timestamp', 'element', element.id, `${element.name}: event without a date or time field`, viewFor(element))
      if (!element.volume?.recordBytes) emit('erd.entity_has_volume', 'element', element.id, `${element.name}: no bytes per row, so no size estimate`, viewFor(element))
      if (element.volume?.refreshMode === 'rebuild' && !element.volume.initialRows) emit('erd.rebuild_without_initial_rows', 'element', element.id, `${element.name}: rebuilt each cycle but its row count is not stated`, viewFor(element))
    }
    const scopeViews = views.filter((view) => view.scopeId === (element.parentId ?? null) && view.kind === scopeViewKindFor(project, element))
    if (scopeViews.length && !scopeViews.some((view) => !view.elementRefs.length || view.elementRefs.includes(element.id))) emit('c4.element_in_some_view', 'element', element.id, `${element.name}: hidden from every view`, scopeViews[0].id)
    if (!relationships.some((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id)) emit('c4.element_has_relationship', 'element', element.id, `${element.name}: no relationships`, viewFor(element))
  })
  relationships.forEach((relationship) => {
    // A relationship ending at a system or application container should name the child it reaches once that child view exists.
    ;(['sourceId', 'targetId'] as const).forEach((side) => {
      const endpoint = project.elements[relationship[side]]
      const childKind = endpoint ? childViewKind(endpoint) : undefined
      // A data store's child view is its ERD; C4 relationships stop at the store, never at a table (rule: erd-scope-integrity).
      if (!endpoint || !childKind || isErdView(childKind)) return
      const childView = views.find((view) => view.kind === childKind && view.scopeId === endpoint.id)
      if (!childView) return
      const level = LEVEL_BY_VIEW_KIND[childKind]
      const mapped = relationship.viewEndpoints?.[level]?.[side]
      if (!mapped || mapped === endpoint.id) emit('c4.relationship_assigned_in_child_view', 'relationship', relationship.id, `${project.elements[relationship.sourceId]?.name ?? '?'} → ${project.elements[relationship.targetId]?.name ?? '?'}: not assigned to a child of ${endpoint.name}`, childView.id)
    })
    const source = project.elements[relationship.sourceId]
    if (!relationship.label.trim() && relationship.erd?.kind !== 'dependent') emit('c4.relationship_has_label', 'relationship', relationship.id, `${source?.name ?? relationship.sourceId} → ${project.elements[relationship.targetId]?.name ?? relationship.targetId}: no label`, source ? viewFor(source) : undefined)
    if (!isErdRelationship(project, relationship) && !relationship.technology?.trim()) emit('c4.relationship_has_technology', 'relationship', relationship.id, `${source?.name ?? relationship.sourceId} → ${project.elements[relationship.targetId]?.name ?? relationship.targetId}: no technology`, source ? viewFor(source) : undefined)
  })
  return findings
}


export function allFindings(project: Project): Finding[] {
  const order: Record<Finding['level'], number> = { error: 0, warning: 1, info: 2 }
  return [...integrityFindings(project), ...checkFindings(project)].sort((a, b) => order[a.level] - order[b.level])
}

export { LEVEL_BY_VIEW_KIND }

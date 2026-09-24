import { allRelationships, connectionVerdict, derivedRelationships, dfdKindOfScope, dfdOf, groupUnits, nodeName, roleForElement, startNodeOf, touchesStore } from './dfd'
import { buildDdl } from './ddl'
import { domainUsage, isDefined, mergeCandidates } from './domains'
import { childViewKind, effectiveCategory, isDfdView, isErdRelationship, isErdStore, isErdView, isViewStorage, itemKindFor, LEVEL_BY_VIEW_KIND, scopeViewKindFor, SQL_STORE_KINDS, storeOf, type Element, type ElementKind, type Project, type ViewKind } from './model'
import { attributeName, bindName, boundOwners, matchesCase, termIndex, termKey, type BoundOwner } from './vocabulary'

export type Level = 'error' | 'warning' | 'info' | 'off'

export interface Finding {
  itemId: string
  level: Exclude<Level, 'off'>
  targetKind: 'element' | 'relationship' | 'view' | 'group' | 'project' | 'node' | 'flow' | 'boundary' | 'domain' | 'vocabulary'
  targetId: string
  message: string
  /** View to open when navigating to the finding, when known. */
  viewId?: string
}

export interface CheckItem {
  id: string
  family: 'c4' | 'erd' | 'dfd' | 'cross' | 'layout' | 'integrity' | 'vocabulary' | 'domain'
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
  { id: 'dfd.flow_has_payload_or_label', family: 'dfd', title: 'Flow has a label or names its data', defaultLevel: 'warning' },
  { id: 'dfd.store_flow_has_operations', family: 'dfd', title: 'Flow touching a data store states its operations', defaultLevel: 'info' },
  { id: 'dfd.atomic_boundary_single_store', family: 'dfd', title: 'Atomic boundary stays within one data store', defaultLevel: 'warning' },
  { id: 'dfd.atomic_boundary_no_queue', family: 'dfd', title: 'Atomic boundary does not cross a queue', defaultLevel: 'warning' },
  { id: 'dfd.boundary_has_flows', family: 'dfd', title: 'Transaction boundary contains at least one flow', defaultLevel: 'warning' },
  { id: 'dfd.node_placed_in_model', family: 'dfd', title: 'DFD node is placed in C4 or an ERD', defaultLevel: 'info' },
  { id: 'dfd.node_has_flow', family: 'dfd', title: 'DFD node takes part in a flow', defaultLevel: 'info' },
  { id: 'dfd.diagram_ref_resolves', family: 'dfd', title: 'Off-page reference points at a DFD', defaultLevel: 'warning' },
  { id: 'dfd.has_start', family: 'dfd', title: 'DFD starts at a start marker that feeds a process', defaultLevel: 'info' },
  { id: 'dfd.response_flow_drawn', family: 'dfd', title: 'Flow answers a request that already implies it', defaultLevel: 'info' },
  { id: 'c4.component_in_placeholder_container', family: 'c4', title: 'Component still lives in the Unknown container', defaultLevel: 'warning' },
  { id: 'c4.derived_relationship_not_materialized', family: 'c4', title: 'Line exists only because of DFD flows', defaultLevel: 'info' },
  { id: 'layout.left_to_right_violations', family: 'layout', title: 'DFD forward flows point left', defaultLevel: 'info' },
  { id: 'vocabulary.registered', family: 'vocabulary', title: 'Bound name is made of registered terms', defaultLevel: 'info' },
  { id: 'vocabulary.alias_match', family: 'vocabulary', title: 'Bound name uses the preferred term, not an alias', defaultLevel: 'info' },
  { id: 'vocabulary.has_system_name', family: 'vocabulary', title: 'Terms of a bound name have a system name', defaultLevel: 'info' },
  { id: 'vocabulary.has_physical_name', family: 'vocabulary', title: 'Terms of a bound name have a physical name', defaultLevel: 'info' },
  { id: 'vocabulary.duplicate_term', family: 'vocabulary', title: 'A lookup term belongs to one entry only', defaultLevel: 'warning' },
  { id: 'vocabulary.physical_name_matches_policy', family: 'vocabulary', title: 'Physical name follows the naming policy case', defaultLevel: 'info' },
  { id: 'vocabulary.plural_missing', family: 'vocabulary', title: 'Term used as a table name has a plural physical name', defaultLevel: 'info' },
  { id: 'domain.duplicate_candidates', family: 'domain', title: 'Domains that differ only by case or separators are merged', defaultLevel: 'warning' },
  { id: 'domain.uncurated', family: 'domain', title: 'Automatic domain has been typed, categorized, or merged', defaultLevel: 'info' },
  { id: 'domain.single_use', family: 'domain', title: 'Domain is shared by more than one field', defaultLevel: 'info' },
  { id: 'domain.has_type', family: 'domain', title: 'Domain assigned to a field has a type', defaultLevel: 'info' },
  { id: 'erd.dialect_lossy_type', family: 'erd', title: 'Column type survives the data store dialect without loss', defaultLevel: 'info' },
]

/** Field names that read as a point in time, in English or Japanese. */
const TIMESTAMP_NAME = /(_at|_on|date|time|timestamp|日時|日付|時刻)$/i

export const CHECK_PROFILES: CheckProfile[] = [
  { id: 'context_sketch', name: 'Context sketch', itemLevels: Object.fromEntries(CHECK_ITEMS.map((item) => [item.id, 'off' as Level])) },
  { id: 'container_sketch', name: 'Container sketch', extends: 'context_sketch', itemLevels: { 'c4.container_has_technology': 'warning', 'c4.relationship_has_label': 'warning', 'c4.relationship_assigned_in_child_view': 'warning', 'c4.data_store_has_dialect': 'info', 'dfd.flow_has_payload_or_label': 'warning', 'dfd.atomic_boundary_single_store': 'warning', 'dfd.atomic_boundary_no_queue': 'warning', 'dfd.boundary_has_flows': 'warning', 'dfd.diagram_ref_resolves': 'warning', 'dfd.node_placed_in_model': 'info', 'c4.component_in_placeholder_container': 'warning', 'dfd.has_start': 'info', 'layout.left_to_right_violations': 'info', 'dfd.response_flow_drawn': 'info' } },
  { id: 'component_complete', name: 'Component complete', extends: 'container_sketch', itemLevels: { 'c4.element_has_description': 'warning', 'c4.application_container_has_component_view': 'warning', 'c4.software_system_has_container_view': 'warning', 'c4.component_has_technology': 'info', 'c4.relationship_has_technology': 'info', 'c4.element_in_some_view': 'info', 'c4.element_has_relationship': 'info', 'erd.data_store_has_entities': 'info', 'erd.entity_has_attributes': 'warning', 'erd.entity_has_primary_key': 'warning', 'erd.entity_has_visible_attribute': 'info', 'erd.entity_has_classification': 'info', 'erd.event_has_timestamp': 'warning', 'dfd.store_flow_has_operations': 'info', 'dfd.node_has_flow': 'info', 'c4.derived_relationship_not_materialized': 'info', 'vocabulary.duplicate_term': 'warning', 'domain.duplicate_candidates': 'warning', 'domain.uncurated': 'info', 'domain.has_type': 'info' } },
  { id: 'export_ready', name: 'Export ready', extends: 'component_complete', itemLevels: { 'c4.element_has_description': 'error', 'c4.container_has_technology': 'error', 'c4.relationship_has_label': 'error', 'c4.relationship_assigned_in_child_view': 'error', 'c4.application_container_has_component_view': 'warning', 'c4.software_system_has_container_view': 'warning', 'c4.data_store_has_dialect': 'warning', 'erd.entity_has_attributes': 'error', 'erd.entity_has_primary_key': 'error', 'erd.entity_has_visible_attribute': 'warning', 'erd.entity_has_classification': 'warning', 'erd.event_has_timestamp': 'warning', 'dfd.flow_has_payload_or_label': 'error', 'dfd.node_placed_in_model': 'warning', 'dfd.diagram_ref_resolves': 'error', 'c4.component_in_placeholder_container': 'error', 'vocabulary.registered': 'warning', 'vocabulary.alias_match': 'warning', 'vocabulary.has_system_name': 'info', 'vocabulary.has_physical_name': 'warning', 'vocabulary.physical_name_matches_policy': 'warning', 'vocabulary.plural_missing': 'warning', 'domain.single_use': 'info', 'domain.uncurated': 'warning', 'domain.has_type': 'error', 'erd.dialect_lossy_type': 'info' } },
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
  topic: ['container'],
  folder: ['container'],
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
      else if ((element.kind === 'topic' || element.kind === 'folder') && itemKindFor(parent) !== element.kind) findings.push({ itemId: 'integrity.parent', level: 'error', targetKind: 'element', targetId: element.id, message: element.kind === 'topic' ? 'Topics belong to pub/sub or queue containers' : 'Folders belong to bucket or file share containers' })
      else if (element.kind === 'entity' && parent.kind === 'entity') {
        // rule: erd-scope-integrity. A dependent entity is named by exactly one dependent relationship from its owner.
        const owners = Object.values(project.relationships).filter((relationship) => relationship.erd?.kind === 'dependent' && relationship.targetId === element.id)
        if (owners.length !== 1 || owners[0].sourceId !== parent.id) findings.push({ itemId: 'integrity.dependent_owner', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.name}: a dependent entity needs exactly one dependent relationship from ${parent.name}` })
      }
    }
    if (element.kind === 'entity') {
      const names = new Set<string>()
      ;(element.attributes ?? []).forEach((attribute) => {
        const name = attributeName(project, attribute)
        const key = name.trim().toLowerCase()
        if (!key) findings.push({ itemId: 'integrity.attribute_name', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.name}: a field has no name` })
        else if (names.has(key)) findings.push({ itemId: 'integrity.attribute_name', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.name}: duplicate field ${name}` })
        names.add(key)
        if (attribute.domainId && !project.domains[attribute.domainId]) findings.push({ itemId: 'integrity.attribute_domain', level: 'error', targetKind: 'element', targetId: element.id, message: `${element.name}.${name}: domain does not exist` })
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
    // A DFD pairs with the C4 level of its scope (rule: dfd-c4-pairing); every other kind follows childViewKind.
    const expectedKind: ViewKind | undefined = isDfdView(view.kind) ? dfdKindOfScope(project, view.scopeId) : view.scopeId ? (scope ? childViewKind(scope) : undefined) : 'c4_context'
    if (expectedKind !== view.kind) findings.push({ itemId: 'integrity.view_scope', level: 'error', targetKind: 'view', targetId: view.id, message: `View kind ${view.kind} does not match its scope`, viewId: view.id })
    if (isDfdView(view.kind)) {
      // rule: dfd-reference-integrity. Nodes resolve, roles match the element, flows join nodes of this DFD legally, boundaries hold this DFD's flows.
      const payload = dfdOf(view)
      Object.values(payload.nodes).forEach((node) => {
        if (node.elementId) {
          const element = project.elements[node.elementId]
          if (!element) findings.push({ itemId: 'integrity.dfd_node_element', level: 'error', targetKind: 'node', targetId: node.id, message: `${view.useCase || view.name}: node references a missing element`, viewId: view.id })
          else if (roleForElement(project, view, element)?.role !== node.role) findings.push({ itemId: 'integrity.dfd_node_role', level: 'error', targetKind: 'node', targetId: node.id, message: `${element.name}: role ${node.role} does not match its position in this DFD`, viewId: view.id })
        } else if (node.role !== 'diagram_ref' && node.role !== 'start' && !node.name.trim()) findings.push({ itemId: 'integrity.dfd_node_name', level: 'error', targetKind: 'node', targetId: node.id, message: `${view.useCase || view.name}: a free node has no name`, viewId: view.id })
        if (node.role === 'diagram_ref' && node.targetViewId && !project.views[node.targetViewId]) findings.push({ itemId: 'integrity.dfd_ref_target', level: 'error', targetKind: 'node', targetId: node.id, message: `${view.useCase || view.name}: reference points at a missing DFD`, viewId: view.id })
      })
      if (Object.values(payload.nodes).filter((node) => node.role === 'start').length > 1) findings.push({ itemId: 'integrity.dfd_start', level: 'error', targetKind: 'view', targetId: view.id, message: `${view.useCase || view.name}: more than one start marker`, viewId: view.id })
      Object.values(payload.flows).forEach((flow) => {
        const source = payload.nodes[flow.sourceNodeId]
        const target = payload.nodes[flow.targetNodeId]
        if (!source || !target) { findings.push({ itemId: 'integrity.dfd_flow_endpoint', level: 'error', targetKind: 'flow', targetId: flow.id, message: `${view.useCase || view.name}: flow endpoint does not resolve`, viewId: view.id }); return }
        if (connectionVerdict(source, target).kind !== 'allowed') findings.push({ itemId: 'integrity.dfd_flow_pair', level: 'error', targetKind: 'flow', targetId: flow.id, message: `${nodeName(project, source)} → ${nodeName(project, target)}: flows join a process with data or an external entity, never two of a kind`, viewId: view.id })
        if (flow.operations.length && !touchesStore(payload, flow)) findings.push({ itemId: 'integrity.dfd_flow_operations', level: 'error', targetKind: 'flow', targetId: flow.id, message: `${nodeName(project, source)} → ${nodeName(project, target)}: operations belong on flows that touch a data store`, viewId: view.id })
      })
      Object.values(payload.boundaries).forEach((boundary) => {
        if (boundary.flowIds.some((flowId) => !payload.flows[flowId])) findings.push({ itemId: 'integrity.dfd_boundary_member', level: 'error', targetKind: 'boundary', targetId: boundary.id, message: `${boundary.name}: boundary lists a flow that is not in this DFD`, viewId: view.id })
      })
      // Logical process groups: members resolve, belong to one group, and never nest in a cycle (data:dfd-process-group).
      const membership = new Map<string, number>()
      Object.values(payload.groups).forEach((group) => {
        group.memberIds.forEach((id) => {
          membership.set(id, (membership.get(id) ?? 0) + 1)
          const node = payload.nodes[id]
          if (!node && !payload.groups[id]) findings.push({ itemId: 'integrity.dfd_group_member', level: 'error', targetKind: 'node', targetId: group.id, message: `${group.name || group.processNumber}: group lists a member that is not in this DFD`, viewId: view.id })
          else if (node && node.role !== 'process' && node.role !== 'intermediate_data') findings.push({ itemId: 'integrity.dfd_group_member', level: 'error', targetKind: 'node', targetId: group.id, message: `${group.name || group.processNumber}: only processes and intermediate data join a logical process`, viewId: view.id })
        })
        if (groupUnits(payload, group).length < 2) findings.push({ itemId: 'integrity.dfd_group_units', level: 'error', targetKind: 'node', targetId: group.id, message: `${group.name || group.processNumber}: a logical process needs two or more processes or groups`, viewId: view.id })
        let current: string | undefined = group.id
        const seen = new Set<string>()
        while (current) {
          if (seen.has(current)) { findings.push({ itemId: 'integrity.dfd_group_cycle', level: 'error', targetKind: 'node', targetId: group.id, message: `${group.name || group.processNumber}: group nesting forms a cycle`, viewId: view.id }); break }
          seen.add(current)
          const parentId: string | undefined = Object.values(payload.groups).find((other) => other.memberIds.includes(current!))?.id
          current = parentId
        }
      })
      membership.forEach((count, id) => { if (count > 1) findings.push({ itemId: 'integrity.dfd_group_member', level: 'error', targetKind: 'node', targetId: id, message: `${view.useCase || view.name}: a member belongs to more than one logical process`, viewId: view.id }) })
    }
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
      if (element.classification === 'event' && attributes.length && !attributes.some((attribute) => TIMESTAMP_NAME.test(attributeName(project, attribute).trim()))) emit('erd.event_has_timestamp', 'element', element.id, `${element.name}: event without a date or time field`, viewFor(element))
      if (!element.volume?.recordBytes) emit('erd.entity_has_volume', 'element', element.id, `${element.name}: no bytes per row, so no size estimate`, viewFor(element))
      if (element.volume?.refreshMode === 'rebuild' && !element.volume.initialRows) emit('erd.rebuild_without_initial_rows', 'element', element.id, `${element.name}: rebuilt each cycle but its row count is not stated`, viewFor(element))
    }
    const scopeViews = views.filter((view) => view.scopeId === (element.parentId ?? null) && view.kind === scopeViewKindFor(project, element))
    if (scopeViews.length && !scopeViews.some((view) => !view.elementRefs.length || view.elementRefs.includes(element.id))) emit('c4.element_in_some_view', 'element', element.id, `${element.name}: hidden from every view`, scopeViews[0].id)
    if (!Object.values(allRelationships(project)).some((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id)) emit('c4.element_has_relationship', 'element', element.id, `${element.name}: no relationships`, viewFor(element))
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
  elements.filter((element) => element.kind === 'component' && project.elements[element.parentId ?? '']?.placeholder).forEach((element) => emit('c4.component_in_placeholder_container', 'element', element.id, `${element.name}: still in ${project.elements[element.parentId!]?.name}`, viewFor(element)))
  Object.values(derivedRelationships(project)).forEach((relationship) => emit('c4.derived_relationship_not_materialized', 'relationship', relationship.id, `${project.elements[relationship.sourceId]?.name ?? '?'} → ${project.elements[relationship.targetId]?.name ?? '?'}: drawn from DFD flows only`, viewFor(project.elements[relationship.sourceId] ?? elements[0])))
  views.filter((view) => isDfdView(view.kind)).forEach((view) => {
    const payload = dfdOf(view)
    const title = view.useCase || view.name || view.kind
    Object.values(payload.nodes).forEach((node) => {
      if (!node.elementId && node.role !== 'diagram_ref') emit('dfd.node_placed_in_model', 'node', node.id, `${title}: ${node.name} is not yet placed in C4 or an ERD`, view.id)
      if (node.role === 'diagram_ref' && !node.targetViewId) emit('dfd.diagram_ref_resolves', 'node', node.id, `${title}: reference has no target DFD`, view.id)
      if (!Object.values(payload.flows).some((flow) => flow.sourceNodeId === node.id || flow.targetNodeId === node.id)) emit('dfd.node_has_flow', 'node', node.id, `${title}: ${nodeName(project, node)} has no flows`, view.id)
    })
    Object.values(payload.flows).forEach((flow) => {
      const source = payload.nodes[flow.sourceNodeId]
      const target = payload.nodes[flow.targetNodeId]
      if (!source || !target) return
      const pair = `${nodeName(project, source)} → ${nodeName(project, target)}`
      if (!flow.label.trim() && !flow.dataRefs.length) emit('dfd.flow_has_payload_or_label', 'flow', flow.id, `${title}: ${pair} has no label and names no data`, view.id)
      // A response paired with its request, directly or through one intermediate node, is implied by the request (requirement: dfd-flow-direction).
      const reaches = (from: string, to: string) => Object.values(payload.flows).some((other) => other.sourceNodeId === from && (other.targetNodeId === to || (payload.nodes[other.targetNodeId]?.role === 'intermediate_data' && Object.values(payload.flows).some((next) => next.sourceNodeId === other.targetNodeId && next.targetNodeId === to))))
      const answersRequest = source.role !== 'start' && reaches(flow.targetNodeId, flow.sourceNodeId) && !(source.role === 'data_store' || target.role === 'data_store')
      if (answersRequest && (target.role === 'process' || target.role === 'external_entity') && source.role !== 'intermediate_data') emit('dfd.response_flow_drawn', 'flow', flow.id, `${title}: ${pair} answers a request that already implies it`, view.id)
      if (touchesStore(payload, flow) && !flow.operations.length) emit('dfd.store_flow_has_operations', 'flow', flow.id, `${title}: ${pair} states no C/R/U/D`, view.id)
    })
    const start = startNodeOf(payload)
    if (!start || !Object.values(payload.flows).some((flow) => flow.sourceNodeId === start.id)) emit('dfd.has_start', 'view', view.id, `${title}: no start marker feeding a process`, view.id)
    // Forward flows that point left after layout, ignoring answers to a flow running the other way (requirement: dfd-flow-direction).
    const positions = view.layout.positions
    const leftward = Object.values(payload.flows).filter((flow) => {
      const source = positions[flow.sourceNodeId]
      const target = positions[flow.targetNodeId]
      if (!source || !target || target.x >= source.x) return false
      return !Object.values(payload.flows).some((other) => other.sourceNodeId === flow.targetNodeId && other.targetNodeId === flow.sourceNodeId)
    })
    if (leftward.length) emit('layout.left_to_right_violations', 'view', view.id, `${title}: ${leftward.length} forward flow${leftward.length === 1 ? '' : 's'} point left`, view.id)
    Object.values(payload.boundaries).forEach((boundary) => {
      const flows = boundary.flowIds.map((id) => payload.flows[id]).filter(Boolean)
      if (!flows.length) { emit('dfd.boundary_has_flows', 'boundary', boundary.id, `${title}: ${boundary.name} contains no flows`, view.id); return }
      if (boundary.consistency !== 'atomic') return
      const nodes = [...new Set(flows.flatMap((flow) => [flow.sourceNodeId, flow.targetNodeId]))].map((id) => payload.nodes[id]).filter(Boolean)
      // A store node stands for its data store container (an entity for the store that owns it): two of them is a distributed transaction.
      const stores = new Set(nodes.filter((node) => node.role === 'data_store').map((node) => { const element = node.elementId ? project.elements[node.elementId] : undefined; return element ? (storeOf(project, element)?.id ?? element.id) : node.id }))
      if (stores.size > 1) emit('dfd.atomic_boundary_single_store', 'boundary', boundary.id, `${title}: ${boundary.name} spans ${stores.size} data stores (distributed transaction)`, view.id)
      if (nodes.some((node) => node.role === 'intermediate_data' && node.intermediateKind === 'queue')) emit('dfd.atomic_boundary_no_queue', 'boundary', boundary.id, `${title}: ${boundary.name} crosses a queue (asynchronous hop)`, view.id)
    })
  })
  vocabularyAndDomainFindings(project, emit, viewFor, profileId)
  return findings
}

type Emit = (itemId: string, targetKind: Finding['targetKind'], targetId: string, message: string, viewId?: string) => void

/** requirement: vocabulary-dictionary and requirement: domain-consolidation checks; bound owners only (decision: vocabulary-binding-scope). */
function vocabularyAndDomainFindings(project: Project, emit: Emit, viewFor: (element: Element) => string | undefined, profileId: string) {
  const target = (owner: BoundOwner): [Finding['targetKind'], string, string | undefined] => {
    if (owner.ref.ownerKind === 'domain') return ['domain', owner.ref.domainId, undefined]
    const element = project.elements[owner.ref.elementId]
    return ['element', owner.ref.elementId, element ? viewFor(element) : undefined]
  }
  const policy = project.settings.namingPolicy
  const entryName = (id: string) => project.vocabulary[id]?.businessName ?? id
  boundOwners(project).forEach((owner) => {
    if (!owner.name.trim()) return
    const binding = bindName(project, owner.name, owner.plural)
    const [kind, id, viewId] = target(owner)
    if (binding.unmatched.length) emit('vocabulary.registered', kind, id, `${owner.label}: unregistered ${binding.unmatched.map((text) => `“${text}”`).join(', ')}`, viewId)
    if (binding.aliasEntries.length) emit('vocabulary.alias_match', kind, id, `${owner.label}: alias of ${binding.aliasEntries.map(entryName).join(', ')}`, viewId)
    if (binding.missingSystem.length) emit('vocabulary.has_system_name', kind, id, `${owner.label}: no system name for ${binding.missingSystem.map(entryName).join(', ')}`, viewId)
    const missingPhysical = owner.plural ? binding.missingPhysical.filter((entryId) => project.vocabulary[entryId]?.physicalName.trim()) : []
    if (missingPhysical.length) emit('vocabulary.plural_missing', kind, id, `${owner.label}: no plural physical name for ${missingPhysical.map(entryName).join(', ')}`, viewId)
    const missing = binding.missingPhysical.filter((entryId) => !missingPhysical.includes(entryId))
    if (missing.length) emit('vocabulary.has_physical_name', kind, id, `${owner.label}: no physical name for ${missing.map(entryName).join(', ')}`, viewId)
  })
  ;[...new Map(termIndex(project.vocabulary).duplicates.map((term) => [termKey(term), term])).values()].forEach((term) => {
    const owners = Object.values(project.vocabulary).filter((entry) => [entry.businessName, ...entry.aliases].some((item) => termKey(item) === termKey(term)))
    owners.forEach((entry) => emit('vocabulary.duplicate_term', 'vocabulary', entry.id, `“${term}” is a term of ${owners.length} entries: ${owners.map((other) => other.businessName).join(', ')}`))
  })
  Object.values(project.vocabulary).forEach((entry) => {
    if (entry.policyException) return
    ;[entry.physicalName, entry.physicalNamePlural ?? ''].filter((name) => name.trim()).forEach((name) => {
      if (!matchesCase(name.trim(), policy.identifierCase)) emit('vocabulary.physical_name_matches_policy', 'vocabulary', entry.id, `${entry.businessName}: physical name ${name} is not ${policy.identifierCase}`)
    })
  })
  // Lossy dialect renderings are reported only when the check is on, since it builds the DDL (requirement: sql-ddl-export).
  if (resolveLevel(profileId, 'erd.dialect_lossy_type') !== 'off') {
    Object.values(project.elements).filter((element) => element.kind === 'container' && element.sqlDialect && element.sqlDialect !== 'postgresql').forEach((store) => {
      buildDdl(project, store.id).issues.filter((issue) => issue.kind === 'lossy').forEach((issue) => emit('erd.dialect_lossy_type', 'element', store.id, `${store.name}: ${issue.message}`, viewFor(store)))
    })
  }
  const usage = domainUsage(project)
  mergeCandidates(project).filter((candidate) => candidate.reason === 'same_name' || candidate.reason === 'same_business_name').forEach((candidate) => {
    const names = candidate.domainIds.map((id) => project.domains[id]?.name ?? id)
    candidate.domainIds.forEach((id) => emit('domain.duplicate_candidates', 'domain', id, `${project.domains[id]?.name}: looks like ${names.filter((name) => name !== project.domains[id]?.name).join(', ')}; merge them`))
  })
  Object.values(project.domains).forEach((domain) => {
    const users = usage.get(domain.id) ?? []
    if (!domain.curated && domain.origin === 'from_field') emit('domain.uncurated', 'domain', domain.id, `${domain.name}: automatic domain not yet typed, categorized, or merged`)
    if (users.length === 1) emit('domain.single_use', 'domain', domain.id, `${domain.name}: used by ${users[0].entity.name}.${attributeName(project, users[0].attribute)} only`)
    if (users.length && !isDefined(project, domain)) emit('domain.has_type', 'domain', domain.id, `${domain.name}: no type; ${users.slice(0, 3).map((item) => `${item.entity.name}.${attributeName(project, item.attribute)}`).join(', ')}${users.length > 3 ? ` +${users.length - 3}` : ''} have no column type`)
  })
}

export function allFindings(project: Project): Finding[] {
  const order: Record<Finding['level'], number> = { error: 0, warning: 1, info: 2 }
  return [...integrityFindings(project), ...checkFindings(project)].sort((a, b) => order[a.level] - order[b.level])
}

export { LEVEL_BY_VIEW_KIND }

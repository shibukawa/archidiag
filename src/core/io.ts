import { assignMissingDomains } from './domains'
import { DEFAULT_NAMING_POLICY, DOMAIN_SHAPES, emptyDfdPayload, emptyProject, ENTITY_CLASSIFICATIONS, isDfdView, LEGACY_CLASSIFICATIONS, makeId, SCHEMA_VERSION, type C4Level, type DataDomain, type DiagramView, type Element, type Position, type Project, type Rect, type Relationship, type ViewKind } from './model'
import { makeView } from './views'

interface LegacyElement extends Element { position?: Position }
interface LegacyProject {
  id: string
  name: string
  version?: number
  schemaVersion?: number
  elements: Record<string, LegacyElement>
  relationships: Record<string, Relationship>
  layouts?: Record<string, { boundary?: Rect; nodePositions?: Record<string, Position> }>
  groups?: Record<string, unknown>
  views?: Record<string, unknown>
  settings?: Partial<Project['settings']>
}

export class ProjectFormatError extends Error {}

/** Parses any supported project JSON and migrates it to the current schema. */
export function parseProject(text: string): Project {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ProjectFormatError('Not valid JSON')
  }
  return migrateProject(raw)
}

/**
 * assignDomains: false keeps the result a pure function of the input, as a shared document needs; fields left
 * without a domain are then repaired once by the server (decision: crdt-collaboration).
 */
export function migrateProject(raw: unknown, options: { assignDomains?: boolean } = {}): Project {
  if (!raw || typeof raw !== 'object') throw new ProjectFormatError('Not a project')
  const data = raw as LegacyProject
  if (!data.id || !data.name || typeof data.elements !== 'object' || typeof data.relationships !== 'object') throw new ProjectFormatError('Missing project fields')
  const version = data.schemaVersion ?? 1
  if (version > SCHEMA_VERSION) throw new ProjectFormatError(`Schema version ${version} is newer than supported ${SCHEMA_VERSION}`)
  if (version >= 2) return normalize(data as unknown as Project, options.assignDomains ?? true)
  return assignMissingDomains(migrateV1(data))
}

function normalize(project: Project, assignDomains: boolean): Project {
  const base = emptyProject(project.name)
  // v2 -> v3 is additive: entities, attributes, erd_component views, and the erd relationship record.
  // v3 -> v4 is additive: dfd_* views with their use case and payload (data:dfd-model).
  // v4 -> v5 is additive: vocabulary, domains, and categories; fields without a domain get their same-named one.
  const normalized: Project = {
    ...base,
    ...project,
    schemaVersion: SCHEMA_VERSION,
    groups: project.groups ?? {},
    views: Object.fromEntries(Object.entries(project.views ?? {}).filter(([, view]) => KNOWN_KINDS.has(view.kind)).map(([id, view]) => [id, normalizeView({ ...makeView(view.kind, view.scopeId, view.name, view.isDefault), ...view, id, layout: { positions: view.layout?.positions ?? {}, boundary: view.layout?.boundary } })])),
    settings: { ...base.settings, ...project.settings, namingPolicy: { ...DEFAULT_NAMING_POLICY, ...project.settings?.namingPolicy } },
    elements: Object.fromEntries(Object.entries(project.elements).map(([id, element]) => [id, normalizeElement(stripLegacy(element as LegacyElement))])),
    vocabulary: Object.fromEntries(Object.entries(project.vocabulary ?? {}).map(([id, entry]) => [id, { ...entry, id, businessName: entry.businessName ?? '', systemName: entry.systemName ?? '', physicalName: entry.physicalName ?? '', meaning: entry.meaning ?? '', notes: entry.notes ?? '', aliases: Array.isArray(entry.aliases) ? entry.aliases.filter((alias) => typeof alias === 'string') : [] }])),
    domainCategories: Object.fromEntries(Object.entries(project.domainCategories ?? {}).map(([id, category]) => [id, { id, name: category.name ?? '' }])),
    domains: Object.fromEntries(Object.entries(project.domains ?? {}).map(([id, domain]) => [id, normalizeDomain({ ...domain, id })])),
  }
  return assignDomains ? assignMissingDomains(normalized) : normalized
}

function normalizeDomain(domain: DataDomain): DataDomain {
  const shape = DOMAIN_SHAPES.includes(domain.shape) ? domain.shape : 'unresolved'
  return {
    ...domain,
    name: domain.name ?? '',
    description: domain.description ?? '',
    origin: domain.origin === 'dictionary' ? 'dictionary' : 'from_field',
    curated: Boolean(domain.curated),
    shape,
    components: domain.components?.map((component) => ({ ...component, id: component.id ?? makeId('dcomp'), name: component.name ?? '', required: component.required ?? true, description: component.description ?? '' })),
    codeSet: domain.codeSet ? { base: domain.codeSet.base ?? { primitive: 'varchar' }, entries: (domain.codeSet.entries ?? []).map((entry) => ({ ...entry, id: entry.id ?? makeId('code'), name: entry.name ?? '', value: entry.value ?? '', description: entry.description ?? '' })) } : undefined,
  }
}

/** Views of a kind this build does not know (pre-release dfd_context and dfd_component) are dropped on import. */
const KNOWN_KINDS = new Set<string>(['c4_context', 'c4_container', 'c4_component', 'erd_component', 'erd_code', 'dfd_container'])

function normalizeView(view: DiagramView): DiagramView {
  if (!isDfdView(view.kind)) return view
  const dfd = view.dfd ?? emptyDfdPayload()
  const nodes = Object.fromEntries(Object.entries(dfd.nodes ?? {}).map(([id, node]) => [id, { ...node, id, name: node.name ?? '', description: node.description ?? '', technology: node.technology ?? '' }]))
  const flows = Object.fromEntries(Object.entries(dfd.flows ?? {}).map(([id, flow]) => [id, { ...flow, id, label: flow.label ?? '', description: flow.description ?? '', technology: flow.technology ?? '', dataRefs: flow.dataRefs ?? [], operations: flow.operations ?? [] }]))
  const boundaries = Object.fromEntries(Object.entries(dfd.boundaries ?? {}).map(([id, boundary]) => [id, { ...boundary, id, description: boundary.description ?? '', consistency: boundary.consistency ?? 'atomic', flowIds: (boundary.flowIds ?? []).filter((flowId) => flows[flowId]) }]))
  const groups = Object.fromEntries(Object.entries(dfd.groups ?? {}).map(([id, group]) => [id, { ...group, id, name: group.name ?? '', description: group.description ?? '', processNumber: group.processNumber ?? '', memberIds: (group.memberIds ?? []).filter((memberId) => nodes[memberId] || (dfd.groups ?? {})[memberId]) }]))
  return { ...view, useCase: view.useCase ?? '', dfd: { ...dfd, nodes, flows, boundaries, groups, nextNumber: dfd.nextNumber ?? Object.keys(nodes).length + 1 }, layout: { ...view.layout, collapsedGroupIds: (view.layout.collapsedGroupIds ?? []).filter((id) => groups[id]) } }
}

function normalizeElement(element: Element): Element {
  if (element.kind !== 'entity') return element
  // Keys this build does not know stay, so a newer editor's fields survive a round trip.
  const attributes = (element.attributes ?? []).map((attribute) => ({ ...attribute, id: attribute.id ?? makeId('attr'), name: attribute.name ?? '', description: attribute.description ?? '', important: Boolean(attribute.important), primaryKey: Boolean(attribute.primaryKey), required: Boolean(attribute.required), unique: Boolean(attribute.unique), ...(attribute.domainId ? { domainId: attribute.domainId } : {}), ...(attribute.useDomainName ? { useDomainName: true } : {}) }))
  const raw = element.classification as string | undefined
  const classification = raw ? (ENTITY_CLASSIFICATIONS.includes(raw as never) ? element.classification : LEGACY_CLASSIFICATIONS[raw]) : undefined
  // Entities carry no free technology text (decision: storage-kind-as-technology).
  return { ...element, attributes, classification, technology: '' }
}

function stripLegacy(element: LegacyElement): Element {
  const { position: _position, ...rest } = element
  return rest
}

/** The prototype stored positions on elements and per-scope layouts keyed "level:scopeId". */
function migrateV1(data: LegacyProject): Project {
  const project: Project = { ...emptyProject(data.name), id: data.id, name: data.name }
  Object.entries(data.elements).forEach(([id, element]) => {
    project.elements[id] = stripLegacy({ ...element, id })
  })
  project.relationships = { ...data.relationships }
  const nodeSize = { width: 220, height: 76 }
  const legacyPosition = (element: LegacyElement, level: C4Level): Position => {
    const position = element.position ?? { x: 40, y: 100 }
    if (level === 'context') return position
    if (element.kind === 'person') return position
    if (element.kind === 'externalSystem') return { x: 960, y: position.y }
    return { x: 300 + position.x * 0.55, y: position.y }
  }
  const ensureView = (kind: ViewKind, scopeId: string | null): DiagramView => {
    const existing = Object.values(project.views).find((view) => view.kind === kind && view.scopeId === scopeId)
    if (existing) return existing
    const view = makeView(kind, scopeId, '', true)
    project.views[view.id] = view
    return view
  }
  const levelOf: Record<ViewKind, C4Level> = { c4_context: 'context', c4_container: 'container', c4_component: 'component', erd_component: 'component', erd_code: 'component', dfd_container: 'container' }
  const scopesToBuild: Array<{ kind: ViewKind; scopeId: string | null }> = [{ kind: 'c4_context', scopeId: null }]
  Object.values(project.elements).forEach((element) => {
    if (element.kind === 'softwareSystem') scopesToBuild.push({ kind: 'c4_container', scopeId: element.id })
    if (element.kind === 'container' && (element.containerCategory ?? (element.dataStoreKind ? 'dataStore' : 'application')) === 'application') scopesToBuild.push({ kind: 'c4_component', scopeId: element.id })
  })
  scopesToBuild.forEach(({ kind, scopeId }) => {
    const level = levelOf[kind]
    const stored = data.layouts?.[`${level}:${scopeId ?? 'root'}`]
    const hasChildren = Object.values(project.elements).some((element) => (element.parentId ?? null) === scopeId)
    if (!stored && !hasChildren && kind !== 'c4_context') return
    const view = ensureView(kind, scopeId)
    const positions: Record<string, Position> = { ...(stored?.nodePositions ?? {}) }
    Object.values(data.elements).forEach((element) => {
      const inScope = (element.parentId ?? null) === scopeId
      const isExternal = !element.parentId && (element.kind === 'person' || element.kind === 'externalSystem')
      if ((inScope || (kind !== 'c4_context' && isExternal)) && !positions[element.id]) positions[element.id] = legacyPosition(element, level)
    })
    view.layout = { positions, boundary: stored?.boundary }
  })
  void nodeSize
  return project
}

export function serializeProject(project: Project): string {
  const ordered: Project = {
    id: project.id,
    name: project.name,
    schemaVersion: SCHEMA_VERSION,
    settings: project.settings,
    elements: sortRecord(project.elements),
    relationships: sortRecord(project.relationships),
    groups: sortRecord(project.groups),
    views: sortRecord(project.views),
    vocabulary: sortRecord(project.vocabulary),
    domainCategories: sortRecord(project.domainCategories),
    domains: sortRecord(project.domains),
  }
  return JSON.stringify(ordered, null, 2)
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]))
}

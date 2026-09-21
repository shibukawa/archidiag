import { emptyProject, ENTITY_CLASSIFICATIONS, LEGACY_CLASSIFICATIONS, makeId, SCHEMA_VERSION, type C4Level, type DiagramView, type Element, type Position, type Project, type Rect, type Relationship, type ViewKind } from './model'
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

export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new ProjectFormatError('Not a project')
  const data = raw as LegacyProject
  if (!data.id || !data.name || typeof data.elements !== 'object' || typeof data.relationships !== 'object') throw new ProjectFormatError('Missing project fields')
  const version = data.schemaVersion ?? 1
  if (version > SCHEMA_VERSION) throw new ProjectFormatError(`Schema version ${version} is newer than supported ${SCHEMA_VERSION}`)
  if (version >= 2) return normalize(data as unknown as Project)
  return migrateV1(data)
}

function normalize(project: Project): Project {
  const base = emptyProject(project.name)
  // v2 -> v3 is additive: entities, attributes, erd_component views, and the erd relationship record.
  return {
    ...base,
    ...project,
    schemaVersion: SCHEMA_VERSION,
    groups: project.groups ?? {},
    views: Object.fromEntries(Object.entries(project.views ?? {}).map(([id, view]) => [id, { ...makeView(view.kind, view.scopeId, view.name, view.isDefault), ...view, id, layout: { positions: view.layout?.positions ?? {}, boundary: view.layout?.boundary } }])),
    settings: { ...base.settings, ...project.settings },
    elements: Object.fromEntries(Object.entries(project.elements).map(([id, element]) => [id, normalizeElement(stripLegacy(element as LegacyElement))])),
  }
}

function normalizeElement(element: Element): Element {
  if (element.kind !== 'entity') return element
  const attributes = (element.attributes ?? []).map((attribute) => ({ id: attribute.id ?? makeId('attr'), name: attribute.name ?? '', description: attribute.description ?? '', important: Boolean(attribute.important), primaryKey: Boolean(attribute.primaryKey), required: Boolean(attribute.required), unique: Boolean(attribute.unique) }))
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
  const levelOf: Record<ViewKind, C4Level> = { c4_context: 'context', c4_container: 'container', c4_component: 'component', erd_component: 'component', erd_code: 'component' }
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
  }
  return JSON.stringify(ordered, null, 2)
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]))
}

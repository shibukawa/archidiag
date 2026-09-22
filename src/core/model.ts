// Runtime-neutral project model. No DOM, React, or Bun APIs here.

export const SCHEMA_VERSION = 4

export type ElementKind = 'person' | 'softwareSystem' | 'externalSystem' | 'container' | 'component' | 'entity' | 'topic' | 'folder'
/** Store items: the component-level children of non-SQL data stores (data:store-item). */
export type StoreItemKind = 'topic' | 'folder'
export type ContainerCategory = 'application' | 'dataStore'
export type DataStoreKind = 'database' | 'databaseSchema' | 'pubSub' | 'queue' | 'bucket' | 'cache' | 'fileShare' | 'other'
export const DATA_STORE_KINDS: DataStoreKind[] = ['database', 'databaseSchema', 'pubSub', 'queue', 'bucket', 'cache', 'fileShare', 'other']
/** Kinds whose physical schema is SQL, so they carry a dialect and own entities (rule: erd-scope-integrity). */
export const SQL_STORE_KINDS: DataStoreKind[] = ['database', 'databaseSchema']
export type SqlDialect = 'postgresql' | 'sqlite' | 'mysql'
export type ApplicationKind = 'webBrowser' | 'mobileApp' | 'desktopApp' | 'server' | 'worker' | 'other'
export const APPLICATION_KINDS: ApplicationKind[] = ['webBrowser', 'mobileApp', 'desktopApp', 'server', 'worker', 'other']
export type C4Level = 'context' | 'container' | 'component'
export type ViewKind = 'c4_context' | 'c4_container' | 'c4_component' | 'erd_component' | 'erd_code' | 'dfd_container'
/** fields is an erd_* mode: the card lists its important attributes instead of the description. */
export type DisplayMode = 'compact' | 'descriptive' | 'technology_only' | 'fields'
export type ThemeId = 'compact' | 'classic_c4' | 'monochrome'

/** T-style ER naming: a resource is a thing that exists (customer, product), an event is something that happened (order, payment). */
export type EntityClassification = 'resource' | 'event' | 'summary' | 'work' | 'code'
/** Physical form of an entity. The DBMS belongs to the data store container; technology stays a free physical note. */
export type EntityStorage = 'table' | 'view' | 'materialized_view'
export const ENTITY_STORAGES: EntityStorage[] = ['table', 'view', 'materialized_view']
export function storageOf(element: Element): EntityStorage { return element.storageKind ?? 'table' }

export type GrowthPeriod = 'day' | 'week' | 'month' | 'year'
export type RefreshMode = 'append' | 'upsert' | 'rebuild'
export type RefreshEvery = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'on_demand'
export const GROWTH_PERIODS: GrowthPeriod[] = ['day', 'week', 'month', 'year']
export const REFRESH_MODES: RefreshMode[] = ['append', 'upsert', 'rebuild']
export const REFRESH_EVERY: RefreshEvery[] = ['hourly', 'daily', 'weekly', 'monthly', 'on_demand']
export const DEFAULT_VOLUME_HORIZON_MONTHS = 36

/** Sizing assumptions on an entity (data:entity-volume). Every field is optional. */
export interface EntityVolume {
  recordBytes?: number
  initialRows?: number
  growthRows?: number
  growthPeriod?: GrowthPeriod
  refreshMode?: RefreshMode
  refreshEvery?: RefreshEvery
  retentionMonths?: number
  note?: string
}

export interface VolumeEstimate { rows: number; bytes: number; dailyWriteRows: number }

const PERIODS_PER_MONTH: Record<GrowthPeriod, number> = { day: 30.4375, week: 4.348, month: 1, year: 1 / 12 }
const CYCLES_PER_DAY: Record<RefreshEvery, number> = { hourly: 24, daily: 1, weekly: 1 / 7, monthly: 1 / 30.4375, on_demand: 0 }

/** Rows, bytes, and daily writes at the horizon; undefined until bytes per row and some row count are known. */
export function estimateVolume(volume: EntityVolume | undefined, horizonMonths: number): VolumeEstimate | undefined {
  if (!volume || !volume.recordBytes || volume.recordBytes <= 0) return undefined
  const initial = volume.initialRows ?? 0
  const growth = volume.growthRows ?? 0
  if (!initial && !growth) return undefined
  const period = volume.growthPeriod ?? 'day'
  const mode = volume.refreshMode ?? 'append'
  const months = volume.retentionMonths && volume.retentionMonths > 0 ? Math.min(horizonMonths, volume.retentionMonths) : horizonMonths
  const growthPerMonth = growth * PERIODS_PER_MONTH[period]
  // A rebuilt table is replaced each cycle, so it never accumulates beyond its stated rows.
  const rows = mode === 'rebuild' ? (initial || growthPerMonth / PERIODS_PER_MONTH[period]) : initial + growthPerMonth * months
  const dailyGrowth = growthPerMonth / PERIODS_PER_MONTH.day
  const dailyWriteRows = dailyGrowth + (mode === 'rebuild' ? rows * CYCLES_PER_DAY[volume.refreshEvery ?? 'daily'] : 0)
  return { rows: Math.round(rows), bytes: Math.round(rows * volume.recordBytes), dailyWriteRows: Math.round(dailyWriteRows) }
}

export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1 }
  return `${index === 0 ? value : value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function formatCount(count: number) {
  if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`
  if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`
  if (count >= 1e3) return `${(count / 1e3).toFixed(count >= 1e4 ? 0 : 1)}K`
  return String(count)
}
export function isViewStorage(element: Element) { return storageOf(element) !== 'table' }
export const ENTITY_CLASSIFICATIONS: EntityClassification[] = ['resource', 'event', 'summary', 'work', 'code']
/** Values used before the T-style names, mapped on import. */
export const LEGACY_CLASSIFICATIONS: Record<string, EntityClassification> = { master: 'resource', transaction: 'event', detail: 'event', history: 'event', log: 'event', snapshot: 'summary', reference: 'code' }

/** UML multiplicity at one relationship end. */
export type Cardinality = '1' | '0..1' | '*' | '1..*'
export const CARDINALITIES: Cardinality[] = ['1', '0..1', '*', '1..*']
export type ErdRelationshipKind = 'reference' | 'dependent' | 'inherit' | 'label'
export const ERD_RELATIONSHIP_KINDS: ErdRelationshipKind[] = ['reference', 'dependent', 'inherit', 'label']

export interface Position { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

/** One column of an entity. Only important attributes render on the canvas (decision: important-fields-on-canvas). */
export interface Attribute {
  id: string
  name: string
  description: string
  important: boolean
  primaryKey: boolean
  required: boolean
  unique: boolean
}

export interface Element {
  id: string
  kind: ElementKind
  name: string
  description: string
  technology: string
  parentId?: string
  groupId?: string
  containerCategory?: ContainerCategory
  applicationKind?: ApplicationKind
  dataStoreKind?: DataStoreKind
  sqlDialect?: SqlDialect
  /** Components only: routes, validates, or adapts without transforming; binds to the API document it handles in a DFD (decision: dfd-passthrough-components). */
  passthrough?: boolean
  /** Containers only: the system's "Unknown container", created on demand for components placed from a DFD (decision: dfd-drives-c4). */
  placeholder?: boolean
  /** Entities only. */
  classification?: EntityClassification
  storageKind?: EntityStorage
  volume?: EntityVolume
  attributes?: Attribute[]
}

export interface ErdRelationship {
  kind: ErdRelationshipKind
  /** References only: draw a reference row on the source card (requirement: erd-field-visibility). */
  important?: boolean
  /** Multiplicity drawn at the source end. For a reference the source is the many side that holds the key. */
  sourceCardinality: Cardinality
  targetCardinality: Cardinality
}

export interface Relationship {
  id: string
  sourceId: string
  targetId: string
  label: string
  technology?: string
  description?: string
  viewEndpoints?: Partial<Record<C4Level, { sourceId: string; targetId: string }>>
  /** Set when both endpoints are entities of one data store. */
  erd?: ErdRelationship
  /** Computed from DFD flows, never stored (decision: dfd-drives-c4). */
  derived?: { members: Array<{ viewId: string; flowId: string }> }
}

export interface Group {
  id: string
  scopeId: string | null
  parentGroupId?: string
  name: string
  description: string
  color?: string
}

// ---------- DFD (data:dfd-model) ----------

/** Gane-Sarson node roles (term:dfd-notation). */
export type DfdRole = 'start' | 'external_entity' | 'process' | 'data_store' | 'intermediate_data' | 'diagram_ref'
export const DFD_ROLES: DfdRole[] = ['start', 'external_entity', 'process', 'data_store', 'intermediate_data', 'diagram_ref']
/** api_document: payload of a synchronous call, the default between two processes; file: a handed-over file; queue: asynchronous events. */
export type IntermediateKind = 'api_document' | 'file' | 'queue'
export const INTERMEDIATE_KINDS: IntermediateKind[] = ['api_document', 'file', 'queue']
export type CrudOperation = 'C' | 'R' | 'U' | 'D'
export const CRUD_OPERATIONS: CrudOperation[] = ['C', 'R', 'U', 'D']
export type Consistency = 'atomic' | 'eventual'

/**
 * One node of a DFD. A bound node projects a canonical element (elementId) and takes its name; a free node
 * was created in the DFD first and carries its own name until it is placed into C4 or an ERD, or bound to an
 * existing element (decision: dfd-first-free-nodes).
 */
export interface DfdNode {
  id: string
  role: DfdRole
  elementId?: string
  name: string
  description: string
  technology: string
  /** intermediate_data only. */
  intermediateKind?: IntermediateKind
  /** Processes only: 1, 2, 2.1; assigned once and never renumbered. */
  processNumber?: string
  /** diagram_ref only: the DFD this off-page connector continues in. */
  targetViewId?: string
}

export interface DfdFlow {
  id: string
  sourceNodeId: string
  targetNodeId: string
  label: string
  description: string
  technology: string
  /** Entity ids or free text naming the data that moves. */
  dataRefs: string[]
  /** CRUD at the data store end; allowed only when one endpoint is a data store. */
  operations: CrudOperation[]
  /** The C4 relationship this flow was imported from; the two draw as one line member (requirement: c4-links-into-dfd). */
  relationshipRef?: string
}

/** Flows that succeed or fail together (data:dfd-transaction-boundary). */
export interface DfdBoundary {
  id: string
  name: string
  description: string
  consistency: Consistency
  flowIds: string[]
}

/**
 * A logical process group: directly connected processes and the intermediate data between them, spoken for by a
 * representative member (UI, else batch, else the most upstream server). Groups nest and are the DFD's levels
 * (decision: dfd-logical-process-group).
 */
export interface DfdGroup {
  id: string
  /** Empty means the representative's name. */
  name: string
  description: string
  /** Node ids (processes and the intermediate data between them) and nested group ids. */
  memberIds: string[]
  /** Number at the group's own level, assigned once; members are numbered beneath it at render time. */
  processNumber: string
}

export interface DfdPayload {
  nodes: Record<string, DfdNode>
  flows: Record<string, DfdFlow>
  boundaries: Record<string, DfdBoundary>
  groups: Record<string, DfdGroup>
  nextNumber: number
}

export function emptyDfdPayload(): DfdPayload {
  return { nodes: {}, flows: {}, boundaries: {}, groups: {}, nextNumber: 1 }
}

export interface ViewLayout {
  positions: Record<string, Position>
  boundary?: Rect
  /** DFD views: process groups drawn as one process instead of their members. */
  collapsedGroupIds?: string[]
}

export interface DiagramView {
  id: string
  kind: ViewKind
  scopeId: string | null
  name: string
  description: string
  isDefault: boolean
  /** Subset of the scope's elements shown in this view. Empty means every element of the scope. */
  elementRefs: string[]
  displayMode: DisplayMode
  layout: ViewLayout
  /** dfd_* views: the scenario the diagram follows, for example "Place order". */
  useCase?: string
  /** dfd_* views: nodes, flows, and transaction boundaries; positions in layout are keyed by node id. */
  dfd?: DfdPayload
}

export interface ProjectSettings {
  styleTheme: ThemeId
  checkProfile: string
  /** Horizon for data volume estimates (data:entity-volume). */
  volumeHorizonMonths: number
}

export interface Project {
  id: string
  name: string
  schemaVersion: number
  elements: Record<string, Element>
  relationships: Record<string, Relationship>
  groups: Record<string, Group>
  views: Record<string, DiagramView>
  settings: ProjectSettings
}

export const VIEW_KIND_BY_LEVEL: Record<C4Level, ViewKind> = {
  context: 'c4_context',
  container: 'c4_container',
  component: 'c4_component',
}

/** erd_component is the data store's sibling of c4_component: same zoom level, different content. */
export const LEVEL_BY_VIEW_KIND: Record<ViewKind, C4Level> = {
  c4_context: 'context',
  c4_container: 'container',
  c4_component: 'component',
  erd_component: 'component',
  erd_code: 'component',
  dfd_container: 'container',
}

export function isErdView(kind: ViewKind) {
  return kind === 'erd_component' || kind === 'erd_code'
}

export function isDfdView(kind: ViewKind) {
  return kind === 'dfd_container'
}

/** DFDs live at container level only: a software system owns them beside its Container views (decision: dfd-container-level-only). */
export function pairedDfdKind(kind: ViewKind): ViewKind | undefined {
  return kind === 'c4_container' || kind === 'dfd_container' ? 'dfd_container' : undefined
}
export function pairedC4Kind(kind: ViewKind): ViewKind {
  return VIEW_KIND_BY_LEVEL[LEVEL_BY_VIEW_KIND[kind]]
}

/** Display modes the toolbar offers for a view kind; erd views trade technology for the field list. */
export function displayModesFor(kind: ViewKind): DisplayMode[] {
  if (isErdView(kind)) return ['descriptive', 'fields', 'compact']
  if (isDfdView(kind)) return ['descriptive', 'compact']
  return ['descriptive', 'compact', 'technology_only']
}

export function childKindForLevel(level: C4Level): ElementKind {
  if (level === 'context') return 'softwareSystem'
  if (level === 'container') return 'container'
  return 'component'
}

/** The element kind that quick create adds inside a view of this kind; an item store's list adds topics or folders. */
export function childKindForView(kind: ViewKind, scope?: Element): ElementKind {
  if (isErdView(kind)) return itemKindFor(scope) ?? 'entity'
  return childKindForLevel(LEVEL_BY_VIEW_KIND[kind])
}

/** Only a software system owns DFDs (decision: dfd-container-level-only). */
export function dfdKindForScope(element: Element | undefined): ViewKind | undefined {
  return element?.kind === 'softwareSystem' ? 'dfd_container' : undefined
}

/** True for database and database schema containers, the only elements that own entities. */
export function isErdStore(element: Element | undefined): boolean {
  return Boolean(element && element.kind === 'container' && effectiveCategory(element) === 'dataStore' && element.dataStoreKind && SQL_STORE_KINDS.includes(element.dataStoreKind))
}

/** The item kind a non-SQL data store owns: topics for pub/sub and queues, folders for buckets and file shares (data:store-item). */
export function itemKindFor(element: Element | undefined): StoreItemKind | undefined {
  if (!element || element.kind !== 'container' || effectiveCategory(element) !== 'dataStore') return undefined
  if (element.dataStoreKind === 'pubSub' || element.dataStoreKind === 'queue') return 'topic'
  if (element.dataStoreKind === 'bucket' || element.dataStoreKind === 'fileShare') return 'folder'
  return undefined
}

export function isItemStore(element: Element | undefined): boolean {
  return Boolean(itemKindFor(element))
}

export function isStoreItem(element: Element | undefined): boolean {
  return element?.kind === 'topic' || element?.kind === 'folder'
}

/** True for components of a screen container (web browser, mobile app, desktop app). */
export function isScreenComponent(project: Project, element: Element | undefined): boolean {
  const parent = element?.kind === 'component' && element.parentId ? project.elements[element.parentId] : undefined
  return Boolean(parent && parent.kind === 'container' && ['webBrowser', 'mobileApp', 'desktopApp'].includes(parent.applicationKind ?? ''))
}

/** True for components of a worker container: batch jobs. */
export function isJobComponent(project: Project, element: Element | undefined): boolean {
  const parent = element?.kind === 'component' && element.parentId ? project.elements[element.parentId] : undefined
  return Boolean(parent && parent.kind === 'container' && parent.applicationKind === 'worker')
}

/** The view kind that opens when zooming into an element, or undefined when it has no child scope. */
export function childViewKind(element: Element): ViewKind | undefined {
  if (element.kind === 'softwareSystem') return 'c4_container'
  if (element.kind === 'container' && effectiveCategory(element) === 'application') return 'c4_component'
  if (isErdStore(element)) return 'erd_component'
  // A pub/sub, queue, bucket, or file share opens its item list, drawn with the same card view.
  if (isItemStore(element)) return 'erd_component'
  // An entity opens its code ERD: itself plus its dependent entities (data:erd-model).
  if (element.kind === 'entity') return 'erd_code'
  return undefined
}

/** The database or schema container that owns an entity, walking up through owner entities. */
export function storeOf(project: Project, element: Element | undefined): Element | undefined {
  let current = element
  while (current && current.kind === 'entity') current = current.parentId ? project.elements[current.parentId] : undefined
  return isErdStore(current) ? current : undefined
}

/** A dependent entity exists only inside its owner entity (data:entity dependency). */
export function isDependentEntity(project: Project, element: Element) {
  return element.kind === 'entity' && project.elements[element.parentId ?? '']?.kind === 'entity'
}

export function dependentsOf(project: Project, ownerId: string): Element[] {
  return childrenOf(project, ownerId).filter((element) => element.kind === 'entity')
}

/** Every entity of a data store, independent and dependent alike. */
export function entitiesOfStore(project: Project, storeId: string): Element[] {
  return Object.values(project.elements).filter((element) => element.kind === 'entity' && storeOf(project, element)?.id === storeId)
}

/** The view kind whose scope contains this element, so selecting it in the explorer opens the right view. */
export function scopeViewKindFor(project: Project, element: Element): ViewKind {
  const parent = element.parentId ? project.elements[element.parentId] : undefined
  if (!parent) return 'c4_context'
  return childViewKind(parent) ?? 'c4_context'
}

export function effectiveCategory(element: Element): ContainerCategory {
  if (element.kind !== 'container') return 'application'
  return element.containerCategory ?? (element.dataStoreKind ? 'dataStore' : 'application')
}

export function isExternalKind(kind: ElementKind) {
  return kind === 'person' || kind === 'externalSystem'
}

export function ancestorIds(project: Project, id: string | null | undefined): string[] {
  const chain: string[] = []
  let current = id ? project.elements[id] : undefined
  while (current) {
    chain.push(current.id)
    current = current.parentId ? project.elements[current.parentId] : undefined
  }
  return chain
}

export function childrenOf(project: Project, scopeId: string | null): Element[] {
  return Object.values(project.elements).filter((element) => (scopeId ? element.parentId === scopeId : !element.parentId))
}

export function makeId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}:${random}`
}

// ---------- entities ----------

export function makeAttribute(name: string, patch: Partial<Attribute> = {}): Attribute {
  return { id: makeId('attr'), name, description: '', important: false, primaryKey: false, required: false, unique: false, ...patch }
}

/** snake_case identifier for a display name, used for the default surrogate key column. */
export function identifierOf(name: string) {
  const ascii = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  return ascii || 'row'
}

/** A new entity starts with a surrogate primary key <entity>_id that is important by default (rule: physical-naming-policy). */
export function defaultAttributesFor(entityName: string): Attribute[] {
  return [makeAttribute(`${identifierOf(entityName)}_id`, { important: true, primaryKey: true, required: true, unique: true })]
}

export const MAX_CARD_ROWS = 8

/** A reference row: the source card names the entity its key points at (decision: reference-source-holds-key). */
export interface ReferenceRow { id: string; label: string; targetName: string }

/** Reference relationships marked important, drawn as chain rows on the key holder's card. */
export function referenceRows(project: Project | undefined, element: Element): ReferenceRow[] {
  if (!project || element.kind !== 'entity') return []
  return Object.values(project.relationships)
    .filter((relationship) => relationship.sourceId === element.id && relationship.erd?.kind === 'reference' && relationship.erd.important)
    .map((relationship) => ({ id: relationship.id, label: relationship.label, targetName: project.elements[relationship.targetId]?.name ?? '?' }))
}

/** The rows an entity card draws in fields mode: important attributes, reference rows, and how many attributes stay hidden. */
export function cardRows(element: Element, project?: Project): { shown: Attribute[]; references: ReferenceRow[]; hidden: number } {
  const attributes = element.attributes ?? []
  const important = attributes.filter((attribute) => attribute.important)
  const shown = important.slice(0, MAX_CARD_ROWS)
  return { shown, references: referenceRows(project, element), hidden: attributes.length - shown.length }
}

export function isErdRelationship(project: Project, relationship: Relationship) {
  return project.elements[relationship.sourceId]?.kind === 'entity' && project.elements[relationship.targetId]?.kind === 'entity'
}

export function defaultErdRelationship(): ErdRelationship {
  return { kind: 'reference', sourceCardinality: '*', targetCardinality: '1' }
}

/** Owner to dependent: one owner row owns many dependent rows and their lifecycle. */
export function dependentRelationship(): ErdRelationship {
  return { kind: 'dependent', sourceCardinality: '1', targetCardinality: '*' }
}

export function emptyProject(name = 'Untitled'): Project {
  return {
    id: makeId('project'),
    name,
    schemaVersion: SCHEMA_VERSION,
    elements: {},
    relationships: {},
    groups: {},
    views: {},
    settings: { styleTheme: 'compact', checkProfile: 'container_sketch', volumeHorizonMonths: DEFAULT_VOLUME_HORIZON_MONTHS },
  }
}

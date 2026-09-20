// Runtime-neutral project model. No DOM, React, or Bun APIs here.

export const SCHEMA_VERSION = 2

export type ElementKind = 'person' | 'softwareSystem' | 'externalSystem' | 'container' | 'component'
export type ContainerCategory = 'application' | 'dataStore'
export type DataStoreKind = 'database' | 'databaseSchema' | 'pubSub' | 'queue' | 'bucket' | 'cache' | 'fileShare' | 'other'
export const DATA_STORE_KINDS: DataStoreKind[] = ['database', 'databaseSchema', 'pubSub', 'queue', 'bucket', 'cache', 'fileShare', 'other']
/** Kinds whose physical schema is SQL, so they carry a dialect. */
export const SQL_STORE_KINDS: DataStoreKind[] = ['database', 'databaseSchema']
export type SqlDialect = 'postgresql' | 'sqlite' | 'mysql'
export type ApplicationKind = 'webBrowser' | 'mobileApp' | 'desktopApp' | 'server' | 'worker' | 'other'
export const APPLICATION_KINDS: ApplicationKind[] = ['webBrowser', 'mobileApp', 'desktopApp', 'server', 'worker', 'other']
export type C4Level = 'context' | 'container' | 'component'
export type ViewKind = 'c4_context' | 'c4_container' | 'c4_component'
export type DisplayMode = 'compact' | 'descriptive' | 'technology_only'
export type ThemeId = 'compact' | 'classic_c4' | 'monochrome'

export interface Position { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

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
}

export interface Relationship {
  id: string
  sourceId: string
  targetId: string
  label: string
  technology?: string
  description?: string
  viewEndpoints?: Partial<Record<C4Level, { sourceId: string; targetId: string }>>
}

export interface Group {
  id: string
  scopeId: string | null
  parentGroupId?: string
  name: string
  description: string
  color?: string
}

export interface ViewLayout {
  positions: Record<string, Position>
  boundary?: Rect
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
}

export interface ProjectSettings {
  styleTheme: ThemeId
  checkProfile: string
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

export const LEVEL_BY_VIEW_KIND: Record<ViewKind, C4Level> = {
  c4_context: 'context',
  c4_container: 'container',
  c4_component: 'component',
}

export function childKindForLevel(level: C4Level): ElementKind {
  if (level === 'context') return 'softwareSystem'
  if (level === 'container') return 'container'
  return 'component'
}

/** The view kind that opens when zooming into an element, or undefined when it has no child scope. */
export function childViewKind(element: Element): ViewKind | undefined {
  if (element.kind === 'softwareSystem') return 'c4_container'
  if (element.kind === 'container' && effectiveCategory(element) === 'application') return 'c4_component'
  return undefined
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

export function emptyProject(name = 'Untitled'): Project {
  return {
    id: makeId('project'),
    name,
    schemaVersion: SCHEMA_VERSION,
    elements: {},
    relationships: {},
    groups: {},
    views: {},
    settings: { styleTheme: 'compact', checkProfile: 'container_sketch' },
  }
}

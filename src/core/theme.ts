import type { ApplicationKind, DataStoreKind, Element, ThemeId } from './model'
import { effectiveCategory } from './model'

export type Shape = 'rounded_box' | 'box' | 'cylinder' | 'horizontal_cylinder' | 'person_figure' | 'bucket' | 'folder' | 'browser_window' | 'mobile_device' | 'desktop_window' | 'card'
export type IconKind = 'person' | 'external' | 'database' | 'schema' | 'queue' | 'bucket' | 'cache' | 'folder' | 'store' | 'system' | 'component' | 'container' | 'terminal' | 'gear' | 'table' | 'none'

export interface Token {
  shape: Shape
  fill: string
  stroke: string
  text: string
  subtext: string
  icon: IconKind
  dash?: string
}

export type TokenKey =
  | 'person'
  | 'softwareSystem'
  | 'externalSystem'
  | 'containerApplication'
  | 'containerDatabase'
  | 'containerSchema'
  | 'containerPubSub'
  | 'containerQueue'
  | 'containerBucket'
  | 'containerCache'
  | 'containerFileShare'
  | 'containerOther'
  | 'component'
  | 'entity'
  | 'externalContext'

export interface Theme {
  id: ThemeId
  name: string
  tokens: Record<TokenKey, Token>
  boundary: { stroke: string; fill: string; text: string }
  group: { stroke: string; fill: string; text: string }
  edge: { stroke: string; text: string; projectedStroke: string }
  frame: { fill: string; stroke: string; text: string; subtext: string }
  background: string
}

const blue = { deep: '#0f3f73', mid: '#2564a8', light: '#6ea3dd', pale: '#c9def5' }

function token(shape: Shape, fill: string, stroke: string, text: string, subtext: string, icon: IconKind, dash?: string): Token {
  return { shape, fill, stroke, text, subtext, icon, dash }
}

const compact: Theme = {
  id: 'compact',
  name: 'Compact',
  tokens: {
    person: token('rounded_box', blue.deep, '#0a2d55', '#ffffff', '#d3e2f7', 'person'),
    softwareSystem: token('rounded_box', '#1b4f8f', '#12406f', '#ffffff', '#d3e2f7', 'system'),
    externalSystem: token('rounded_box', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'external'),
    containerApplication: token('rounded_box', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'container'),
    containerDatabase: token('cylinder', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'database'),
    containerSchema: token('cylinder', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'schema'),
    containerPubSub: token('horizontal_cylinder', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'queue'),
    containerQueue: token('horizontal_cylinder', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'queue'),
    containerBucket: token('bucket', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'bucket'),
    containerCache: token('rounded_box', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'cache'),
    containerFileShare: token('folder', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'folder'),
    containerOther: token('rounded_box', blue.mid, '#1d5391', '#ffffff', '#dbe8f8', 'store'),
    component: token('rounded_box', '#85bbf0', '#5f9adb', '#0b1a2e', '#22406a', 'component'),
    // Card: the fill paints the header band; the body is drawn in the theme background.
    entity: token('card', '#c7ddf6', '#5f9adb', '#0b1a2e', '#22406a', 'table'),
    externalContext: token('rounded_box', '#8c8c8c', '#6f6f6f', '#ffffff', '#ececec', 'external'),
  },
  boundary: { stroke: '#4b5563', fill: 'rgba(148,163,184,0.08)', text: '#374151' },
  group: { stroke: '#9ca3af', fill: 'rgba(156,163,175,0.10)', text: '#4b5563' },
  edge: { stroke: '#4b5563', text: '#374151', projectedStroke: '#6b7280' },
  frame: { fill: '#ffffff', stroke: '#cbd5e1', text: '#111827', subtext: '#6b7280' },
  background: '#f8fafc',
}

const classic: Theme = {
  ...compact,
  id: 'classic_c4',
  name: 'Classic C4',
  tokens: {
    ...compact.tokens,
    person: { ...compact.tokens.person, shape: 'person_figure', fill: '#08427b', stroke: '#052e56' },
    softwareSystem: { ...compact.tokens.softwareSystem, fill: '#1168bd', stroke: '#0b4884' },
    containerApplication: { ...compact.tokens.containerApplication, fill: '#438dd5', stroke: '#2e6295' },
    containerDatabase: { ...compact.tokens.containerDatabase, fill: '#438dd5', stroke: '#2e6295' },
    containerSchema: { ...compact.tokens.containerSchema, fill: '#438dd5', stroke: '#2e6295' },
    containerPubSub: { ...compact.tokens.containerPubSub, fill: '#438dd5', stroke: '#2e6295' },
    containerQueue: { ...compact.tokens.containerQueue, fill: '#438dd5', stroke: '#2e6295' },
    containerBucket: { ...compact.tokens.containerBucket, fill: '#438dd5', stroke: '#2e6295' },
    containerCache: { ...compact.tokens.containerCache, fill: '#438dd5', stroke: '#2e6295' },
    containerFileShare: { ...compact.tokens.containerFileShare, fill: '#438dd5', stroke: '#2e6295' },
    containerOther: { ...compact.tokens.containerOther, fill: '#438dd5', stroke: '#2e6295' },
    component: { ...compact.tokens.component, fill: '#85bbf0', stroke: '#5d82a8' },
    entity: { ...compact.tokens.entity, fill: '#b9d3f2', stroke: '#5d82a8' },
    externalSystem: { ...compact.tokens.externalSystem, fill: '#999999', stroke: '#6b6b6b' },
    externalContext: { ...compact.tokens.externalContext, fill: '#999999', stroke: '#6b6b6b' },
  },
}

const mono: Theme = {
  ...compact,
  id: 'monochrome',
  name: 'Monochrome',
  tokens: {
    person: token('rounded_box', '#1f2937', '#111827', '#ffffff', '#d1d5db', 'person'),
    softwareSystem: token('rounded_box', '#374151', '#1f2937', '#ffffff', '#d1d5db', 'system'),
    externalSystem: token('rounded_box', '#9ca3af', '#6b7280', '#111827', '#374151', 'external'),
    containerApplication: token('rounded_box', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'container'),
    containerDatabase: token('cylinder', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'database'),
    containerSchema: token('cylinder', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'schema'),
    containerPubSub: token('horizontal_cylinder', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'queue'),
    containerQueue: token('horizontal_cylinder', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'queue'),
    containerBucket: token('bucket', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'bucket'),
    containerCache: token('rounded_box', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'cache'),
    containerFileShare: token('folder', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'folder'),
    containerOther: token('rounded_box', '#6b7280', '#4b5563', '#ffffff', '#e5e7eb', 'store'),
    component: token('rounded_box', '#d1d5db', '#9ca3af', '#111827', '#374151', 'component'),
    entity: token('card', '#e5e7eb', '#9ca3af', '#111827', '#4b5563', 'table'),
    externalContext: token('rounded_box', '#e5e7eb', '#9ca3af', '#111827', '#4b5563', 'external'),
  },
  edge: { stroke: '#374151', text: '#1f2937', projectedStroke: '#6b7280' },
}

export const THEMES: Record<ThemeId, Theme> = { compact, classic_c4: classic, monochrome: mono }

export function tokenKeyFor(element: Element, isExternalContext: boolean): TokenKey {
  if (isExternalContext) return 'externalContext'
  if (element.kind === 'person') return 'person'
  if (element.kind === 'softwareSystem') return 'softwareSystem'
  if (element.kind === 'externalSystem') return 'externalSystem'
  if (element.kind === 'component') return 'component'
  if (element.kind === 'entity') return 'entity'
  if (effectiveCategory(element) === 'application') return 'containerApplication'
  const kinds: Record<DataStoreKind, TokenKey> = { database: 'containerDatabase', databaseSchema: 'containerSchema', pubSub: 'containerPubSub', queue: 'containerQueue', bucket: 'containerBucket', cache: 'containerCache', fileShare: 'containerFileShare', other: 'containerOther' }
  return kinds[element.dataStoreKind ?? 'other']
}

const APPLICATION_SHAPES: Record<ApplicationKind, { shape: Shape; icon: IconKind }> = {
  webBrowser: { shape: 'browser_window', icon: 'none' },
  mobileApp: { shape: 'mobile_device', icon: 'none' },
  desktopApp: { shape: 'desktop_window', icon: 'none' },
  server: { shape: 'rounded_box', icon: 'terminal' },
  worker: { shape: 'rounded_box', icon: 'gear' },
  other: { shape: 'rounded_box', icon: 'container' },
}

/** External context keeps its kind's shape and icon but takes the gray token colors. */
export function tokenFor(theme: Theme, element: Element, isExternalContext: boolean): Token {
  let own = theme.tokens[tokenKeyFor(element, false)]
  if (element.kind === 'container' && effectiveCategory(element) === 'application' && element.applicationKind) own = { ...own, ...APPLICATION_SHAPES[element.applicationKind] }
  if (!isExternalContext) return own
  const gray = theme.tokens.externalContext
  return { ...gray, shape: own.shape, icon: own.icon === 'external' ? 'external' : own.icon }
}

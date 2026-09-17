import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { jsPDF } from 'jspdf'

type DiagramLevel = 'context' | 'container' | 'component'
type ElementKind = 'person' | 'softwareSystem' | 'externalSystem' | 'container' | 'component'
type ContainerCategory = 'application' | 'dataStore'
type DataStoreKind = 'database' | 'databaseSchema' | 'pubSub' | 'other'

type Position = { x: number; y: number }

type C4Element = {
  id: string
  kind: ElementKind
  name: string
  description: string
  technology: string
  parentId?: string
  position: Position
  containerCategory?: ContainerCategory
  dataStoreKind?: DataStoreKind
}

type Relationship = {
  id: string
  sourceId: string
  targetId: string
  label: string
  technology?: string
  viewEndpoints?: Partial<Record<DiagramLevel, { sourceId: string; targetId: string }>>
}

type BoundaryRect = { x: number; y: number; width: number; height: number }
type DiagramLayout = { boundary?: BoundaryRect; nodePositions?: Record<string, Position> }

type C4Project = {
  id: string
  name: string
  version: number
  elements: Record<string, C4Element>
  relationships: Record<string, Relationship>
  layouts?: Record<string, DiagramLayout>
}

type Scope = { level: DiagramLevel; scopeId: string | null }
type Locale = 'en' | 'ja'
type ExportFormat = 'json' | 'pdf' | 'drawio' | 'png' | 'svg'
type RenderNode = { element: C4Element; x: number; y: number; isExternal: boolean }
type DragState = { id: string; pointerId: number; startX: number; startY: number; originX: number; originY: number }
type BoundaryResizeState = { pointerId: number; startX: number; startY: number; originWidth: number; originHeight: number }

const LOCALE_KEY = 'archidiag-locale'

const copy: Record<Locale, {
  studio: string
  local: string
  webmcpReady: string
  manualMode: string
  validate: string
  import: string
  exportJson: string
  exportPdf: string
  exportDrawio: string
  exportPng: string
  exportSvg: string
  exportMenu: string
  projectExplorer: string
  addElement: string
  searchModel: string
  systemContext: string
  modelNotes: string
  modelNote: string
  allChangesSaved: string
  unsavedChanges: string
  project: string
  syncedLocally: string
  doubleClickToEnter: string
  relationshipsUpdate: string
  canvasSaved: string
  dragToMove: string
  systemBoundary: string
  outsideBoundary: string
  undo: string
  redo: string
  inspector: string
  moreInspector: string
  nothingSelected: string
  canonicalElement: string
  selectNode: string
  selectNodeHint: string
  name: string
  description: string
  technology: string
  parentScope: string
  projectRoot: string
  open: string
  singleSource: string
  singleSourceHint: string
  deleteElement: string
  deleteAndChildren: string
  collaboration: string
  comingNext: string
  localOnly: string
  connectService: string
  new: string
  addTo: string
  linkedToCurrent: string
  cancel: string
  namePlaceholder: string
  responsibilityPlaceholder: string
  containerCategory: string
  applicationContainer: string
  dataStore: string
  dataStoreKind: string
  database: string
  databaseSchema: string
  pubSub: string
  other: string
  elementAdded: string
  elementsDeleted: string
  elementDeleted: string
  projectExported: string
  exportComplete: string
  exportFailed: string
  projectImported: string
  importFailed: string
  validModel: string
  validationIssues: string
}> = {
  en: {
    studio: 'C4 model studio', local: 'LOCAL', webmcpReady: 'WebMCP ready', manualMode: 'Manual mode', validate: 'Validate', import: 'Import', exportJson: 'Export JSON', exportPdf: 'PDF', exportDrawio: 'draw.io', exportPng: 'PNG', exportSvg: 'SVG', exportMenu: 'Export diagram',
    projectExplorer: 'Project explorer', addElement: 'Add element', searchModel: 'Search model', systemContext: 'System Context', modelNotes: 'Model notes',
    modelNote: 'Double-click a software system or container to enter its child scope. Names are shared across every view.', allChangesSaved: 'All changes saved locally', unsavedChanges: 'Unsaved changes are stored locally',
    project: 'Project', syncedLocally: 'Synced locally', doubleClickToEnter: 'double-click to enter scope', relationshipsUpdate: 'relationships update with model', canvasSaved: 'Canvas coordinates and boundary size are saved per view', dragToMove: 'drag to move', systemBoundary: 'System boundary', outsideBoundary: 'Outside boundary', undo: 'Undo', redo: 'Redo',
    inspector: 'Inspector', moreInspector: 'More inspector actions', nothingSelected: 'Nothing selected', canonicalElement: 'Canonical model element · changes propagate to every linked view', selectNode: 'Select a node', selectNodeHint: 'Edit a name, description, or technology. The model stays linked across every level.',
    name: 'Name', description: 'Description', technology: 'Technology', parentScope: 'Parent scope', projectRoot: 'Project root', open: 'Open', singleSource: 'Single source of truth', singleSourceHint: 'Rename this element once. Every diagram resolves its label from the same canonical record.', deleteElement: 'Delete element', deleteAndChildren: ' and children',
    collaboration: 'Collaboration', comingNext: 'coming next', localOnly: 'Local-only session', connectService: 'Connect a collaboration service', new: 'New', addTo: 'Add to', linkedToCurrent: 'This element will be linked to the current scope.', cancel: 'Cancel',
    namePlaceholder: 'e.g. Analytics Platform', responsibilityPlaceholder: 'What responsibility does it have?', containerCategory: 'Container type', applicationContainer: 'Application', dataStore: 'Data store', dataStoreKind: 'Data store kind', database: 'Database', databaseSchema: 'Database schema', pubSub: 'Pub/Sub', other: 'Other', elementAdded: ' added', elementsDeleted: ' and child element(s) deleted', elementDeleted: ' deleted', projectExported: 'Project exported as JSON', exportComplete: 'Diagram exported as', exportFailed: 'Export failed', projectImported: 'Project imported successfully', importFailed: 'Import failed: choose a valid ArchiDiag JSON file', validModel: 'Model is valid — no blocking issues', validationIssues: ' validation issue(s) found',
  },
  ja: {
    studio: 'C4モデルスタジオ', local: 'ローカル', webmcpReady: 'WebMCP対応', manualMode: '手動モード', validate: '検証', import: 'インポート', exportJson: 'JSONを書き出す', exportPdf: 'PDF', exportDrawio: 'draw.io', exportPng: 'PNG', exportSvg: 'SVG', exportMenu: '図を書き出す',
    projectExplorer: 'プロジェクト', addElement: '要素を追加', searchModel: 'モデルを検索', systemContext: 'システムコンテキスト', modelNotes: 'モデルメモ',
    modelNote: 'ソフトウェアシステムまたはコンテナをダブルクリックすると子階層に入ります。名前はすべてのビューで共有されます。', allChangesSaved: '変更はローカルに保存されています', unsavedChanges: '変更をローカルに保存しました',
    project: 'プロジェクト', syncedLocally: 'ローカル同期', doubleClickToEnter: 'ダブルクリックで移動', relationshipsUpdate: '関係もモデルに連動', canvasSaved: 'キャンバス位置と境界サイズはビューごとに保存されます', dragToMove: 'ドラッグで移動', systemBoundary: 'システム境界', outsideBoundary: '境界の外', undo: '元に戻す', redo: 'やり直す',
    inspector: 'インスペクター', moreInspector: 'その他の操作', nothingSelected: '未選択', canonicalElement: '正規モデル要素 · 変更はすべての関連ビューに反映されます', selectNode: 'ノードを選択', selectNodeHint: '名前・説明・技術を編集できます。モデルはすべての階層で連動します。',
    name: '名前', description: '説明', technology: '技術', parentScope: '親スコープ', projectRoot: 'プロジェクトルート', open: '開く', singleSource: '単一の正規情報源', singleSourceHint: 'この要素の名前を一度変更すると、すべての図が同じ正規レコードを参照します。', deleteElement: '要素を削除', deleteAndChildren: 'と子要素',
    collaboration: '共同編集', comingNext: '次のステップ', localOnly: 'ローカルのみ', connectService: '共同編集サービスに接続', new: '新しい', addTo: '追加先', linkedToCurrent: 'この要素は現在のスコープに紐づきます。', cancel: 'キャンセル',
    namePlaceholder: '例：分析プラットフォーム', responsibilityPlaceholder: 'どんな責務を持ちますか？', containerCategory: 'コンテナ種別', applicationContainer: 'アプリケーション', dataStore: 'データストア', dataStoreKind: 'データストアの種類', database: 'データベース', databaseSchema: 'データベーススキーマ', pubSub: 'Pub/Sub', other: 'その他', elementAdded: 'を追加しました', elementsDeleted: 'と子要素を削除しました', elementDeleted: 'を削除しました', projectExported: 'プロジェクトをJSONで書き出しました', exportComplete: '図を書き出しました：', exportFailed: '書き出しに失敗しました', projectImported: 'プロジェクトを読み込みました', importFailed: '読み込みに失敗しました：ArchiDiagのJSONを選択してください', validModel: 'モデルは有効です — 問題はありません', validationIssues: '件の検証問題があります',
  },
}

type IconName =
  | 'grid'
  | 'folder'
  | 'chevron'
  | 'chevronDown'
  | 'search'
  | 'plus'
  | 'download'
  | 'upload'
  | 'undo'
  | 'redo'
  | 'check'
  | 'more'
  | 'link'
  | 'database'
  | 'box'
  | 'user'
  | 'globe'
  | 'layers'
  | 'spark'
  | 'trash'
  | 'arrow'
  | 'external'
  | 'command'

function Icon({ name, size = 16, stroke = 1.8, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className }
  const paths: Record<IconName, ReactElement> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /><path d="M3 10h18" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 21h16" /></>,
    upload: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5M4 21h16" /></>,
    undo: <><path d="M9 7 4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 7 5 5-5 5" /><path d="M20 12H10a6 6 0 0 0-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" /><path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.15-1.15" /></>,
    database: <><ellipse cx="12" cy="5.5" rx="7" ry="3" /><path d="M5 5.5v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6M5 11.5v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
    spark: <><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8z" /><path d="m19 16-.8 2.2L16 19l2.2.8L19 22l.8-2.2L22 19l-2.2-.8z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="m6 7 1 14h10l1-14M9 7V4h6v3" /></>,
    arrow: <><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    command: <><path d="M18 8a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V5a3 3 0 1 0-3 3z" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

const STORAGE_KEY = 'archidiag-project-v1'
const canvasWidth = 1200
const canvasHeight = 590
const nodeWidth = 224
const nodeHeight = 116
const defaultSystemBoundary: BoundaryRect = { x: 260, y: 64, width: 670, height: 474 }

const kindMeta: Record<ElementKind, { label: string; icon: IconName; accent: string; badge: string; canEnter: boolean }> = {
  person: { label: 'Person', icon: 'user', accent: 'border-amber/65', badge: 'bg-amber/10 text-amber', canEnter: false },
  softwareSystem: { label: 'Software system', icon: 'globe', accent: 'border-cyan/70', badge: 'bg-cyan/10 text-cyan', canEnter: true },
  externalSystem: { label: 'External system', icon: 'external', accent: 'border-violet/65', badge: 'bg-violet/10 text-violet', canEnter: false },
  container: { label: 'Container', icon: 'box', accent: 'border-cyan/60', badge: 'bg-cyan/10 text-cyan', canEnter: true },
  component: { label: 'Component', icon: 'layers', accent: 'border-violet/70', badge: 'bg-violet/10 text-violet', canEnter: false },
}

const kindLabels: Record<Locale, Record<ElementKind, string>> = {
  en: { person: 'Person', softwareSystem: 'Software system', externalSystem: 'External system', container: 'Container', component: 'Component' },
  ja: { person: '人', softwareSystem: 'ソフトウェアシステム', externalSystem: '外部システム', container: 'コンテナ', component: 'コンポーネント' },
}

const containerCategoryLabels: Record<Locale, Record<ContainerCategory, string>> = {
  en: { application: 'Application', dataStore: 'Data store' },
  ja: { application: 'アプリケーション', dataStore: 'データストア' },
}

const dataStoreKindLabels: Record<Locale, Record<DataStoreKind, string>> = {
  en: { database: 'Database', databaseSchema: 'Database schema', pubSub: 'Pub/Sub', other: 'Other' },
  ja: { database: 'データベース', databaseSchema: 'データベーススキーマ', pubSub: 'Pub/Sub', other: 'その他' },
}

function elementRoleLabel(element: C4Element, locale: Locale) {
  if (element.kind !== 'container') return kindLabels[locale][element.kind]
  const category = element.containerCategory ?? (element.dataStoreKind ? 'dataStore' : 'application')
  if (category === 'dataStore') return `${containerCategoryLabels[locale][category]} · ${dataStoreKindLabels[locale][element.dataStoreKind ?? 'other']}`
  return `${containerCategoryLabels[locale][category]} · ${kindLabels[locale].container}`
}

const levelMeta: Record<Locale, Record<DiagramLevel, { label: string; short: string; description: string }>> = {
  en: {
    context: { label: 'System Context', short: 'Context', description: 'People and systems around the selected product' },
    container: { label: 'Container', short: 'Container', description: 'Applications and data stores inside this system' },
    component: { label: 'Component', short: 'Component', description: 'Building blocks inside this container' },
  },
  ja: {
    context: { label: 'システムコンテキスト', short: 'コンテキスト', description: '対象システムを取り巻く人とシステム' },
    container: { label: 'コンテナ', short: 'コンテナ', description: 'このシステムの内部にあるアプリケーションとデータストア' },
    component: { label: 'コンポーネント', short: 'コンポーネント', description: 'このコンテナの内部にある構成要素' },
  },
}

function makeSeedProject(): C4Project {
  const elements: C4Element[] = [
    { id: 'person:customer', kind: 'person', name: 'Customer', description: 'A shopper using the commerce experience.', technology: 'Human', position: { x: 42, y: 220 } },
    { id: 'system:commerce', kind: 'softwareSystem', name: 'Commerce Platform', description: 'Online commerce platform for browsing, checkout, and fulfillment.', technology: 'Web application', position: { x: 366, y: 205 } },
    { id: 'system:payment', kind: 'externalSystem', name: 'Payment Provider', description: 'External service that authorizes card payments.', technology: 'HTTPS API', position: { x: 710, y: 220 } },
    { id: 'container:web', kind: 'container', parentId: 'system:commerce', name: 'Web Application', description: 'Customer-facing web experience.', technology: 'React / TypeScript', containerCategory: 'application', position: { x: 42, y: 190 } },
    { id: 'container:api', kind: 'container', parentId: 'system:commerce', name: 'API Application', description: 'Backend API for commerce use cases.', technology: 'Node.js', containerCategory: 'application', position: { x: 378, y: 138 } },
    { id: 'container:db', kind: 'container', parentId: 'system:commerce', name: 'Commerce Database', description: 'Persistent store for orders, products, and customers.', technology: 'PostgreSQL', containerCategory: 'dataStore', dataStoreKind: 'database', position: { x: 378, y: 350 } },
    { id: 'component:checkout', kind: 'component', parentId: 'container:api', name: 'Checkout Service', description: 'Coordinates cart validation and payment authorization.', technology: 'TypeScript', position: { x: 62, y: 120 } },
    { id: 'component:orders', kind: 'component', parentId: 'container:api', name: 'Order Controller', description: 'Exposes order lifecycle endpoints.', technology: 'REST', position: { x: 378, y: 120 } },
    { id: 'component:catalog', kind: 'component', parentId: 'container:api', name: 'Catalog Repository', description: 'Reads product and inventory data.', technology: 'SQL', position: { x: 694, y: 120 } },
  ]
  const relationships: Relationship[] = [
    { id: 'rel:customer-commerce', sourceId: 'person:customer', targetId: 'system:commerce', label: 'shops online', viewEndpoints: { container: { sourceId: 'person:customer', targetId: 'container:web' } } },
    { id: 'rel-commerce-payment', sourceId: 'system:commerce', targetId: 'system:payment', label: 'authorizes payments', technology: 'HTTPS', viewEndpoints: { container: { sourceId: 'container:api', targetId: 'system:payment' } } },
    { id: 'rel-web-api', sourceId: 'container:web', targetId: 'container:api', label: 'uses', technology: 'JSON/HTTPS' },
    { id: 'rel-api-db', sourceId: 'container:api', targetId: 'container:db', label: 'reads and writes', technology: 'SQL' },
    { id: 'rel-checkout-payment', sourceId: 'component:checkout', targetId: 'system:payment', label: 'authorizes', technology: 'HTTPS' },
    { id: 'rel-orders-db', sourceId: 'component:orders', targetId: 'container:db', label: 'persists orders', technology: 'SQL' },
  ]
  return {
    id: 'project:commerce-platform',
    name: 'Commerce Platform',
    version: 1,
    elements: Object.fromEntries(elements.map((element) => [element.id, element])),
    relationships: Object.fromEntries(relationships.map((relationship) => [relationship.id, relationship])),
  }
}

function loadProject(): C4Project {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as C4Project
      const seed = makeSeedProject()
      return {
        ...parsed,
        elements: Object.fromEntries(Object.entries(parsed.elements).map(([id, element]) => [id, {
          ...element,
          containerCategory: element.containerCategory ?? seed.elements[id]?.containerCategory,
          dataStoreKind: element.dataStoreKind ?? seed.elements[id]?.dataStoreKind,
        }])),
        relationships: Object.fromEntries(Object.entries(parsed.relationships).map(([id, relationship]) => [id, { ...relationship, viewEndpoints: relationship.viewEndpoints ?? seed.relationships[id]?.viewEndpoints }])),
      }
    }
  } catch {
    // Fall back to the starter model when storage is unavailable or corrupt.
  }
  return makeSeedProject()
}

function kindForLevel(level: DiagramLevel): ElementKind {
  if (level === 'context') return 'softwareSystem'
  if (level === 'container') return 'container'
  return 'component'
}

function scopeLayoutKey(scope: Scope) {
  return `${scope.level}:${scope.scopeId ?? 'root'}`
}

function getDiagramLayout(project: C4Project, scope: Scope): DiagramLayout {
  return project.layouts?.[scopeLayoutKey(scope)] ?? {}
}

function getDiagramBoundary(project: C4Project, scope: Scope): BoundaryRect {
  return getDiagramLayout(project, scope).boundary ?? defaultSystemBoundary
}

function rectanglesOverlap(position: Position, boundary: BoundaryRect) {
  return position.x < boundary.x + boundary.width && position.x + nodeWidth > boundary.x && position.y < boundary.y + boundary.height && position.y + nodeHeight > boundary.y
}

function keepOutsideBoundary(position: Position, boundary: BoundaryRect): Position {
  if (!rectanglesOverlap(position, boundary)) return position
  const gap = 24
  const clampY = Math.max(0, Math.min(position.y, Math.max(0, canvasHeight - nodeHeight)))
  const clampX = Math.max(0, Math.min(position.x, Math.max(0, canvasWidth - nodeWidth)))
  const candidates = [
    { x: Math.max(0, boundary.x - nodeWidth - gap), y: clampY },
    { x: boundary.x + boundary.width + gap, y: clampY },
    { x: clampX, y: Math.max(0, boundary.y - nodeHeight - gap) },
    { x: clampX, y: boundary.y + boundary.height + gap },
  ]
  const validCandidates = candidates.filter((candidate) => !rectanglesOverlap(candidate, boundary))
  const options = validCandidates.length ? validCandidates : candidates
  return options.sort((a, b) => Math.hypot(a.x - position.x, a.y - position.y) - Math.hypot(b.x - position.x, b.y - position.y))[0]
}

function expandBoundaryToContain(boundary: BoundaryRect, position: Position): BoundaryRect {
  const padding = 24
  const left = Math.max(0, Math.min(boundary.x, position.x - padding))
  const top = Math.max(0, Math.min(boundary.y, position.y - padding))
  const right = Math.max(boundary.x + boundary.width, position.x + nodeWidth + padding)
  const bottom = Math.max(boundary.y + boundary.height, position.y + nodeHeight + padding)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function moveOverlappingExternalNodes(nodes: RenderNode[], boundary: BoundaryRect, draggedId?: string) {
  const adjustments: Record<string, Position> = {}
  nodes.forEach((node) => {
    if (!node.isExternal || node.element.id === draggedId) return
    const next = keepOutsideBoundary({ x: node.x, y: node.y }, boundary)
    if (next.x !== node.x || next.y !== node.y) adjustments[node.element.id] = next
  })
  return adjustments
}

function visibleElements(project: C4Project, scope: Scope) {
  if (scope.level === 'context') return Object.values(project.elements).filter((element) => !element.parentId)
  const children = Object.values(project.elements).filter((element) => element.parentId === scope.scopeId)
  const childIds = new Set(children.map((element) => element.id))
  const ownerIds = new Set<string>()
  let owner = scope.scopeId ? project.elements[scope.scopeId] : undefined
  while (owner) {
    ownerIds.add(owner.id)
    owner = owner.parentId ? project.elements[owner.parentId] : undefined
  }
  const external = Object.values(project.elements).filter((element) => {
    if (element.parentId || (element.kind !== 'person' && element.kind !== 'externalSystem')) return false
    return Object.values(project.relationships).some((relationship) => {
      const touchesExternal = relationship.sourceId === element.id || relationship.targetId === element.id
      const otherId = relationship.sourceId === element.id ? relationship.targetId : relationship.sourceId
      return touchesExternal && (ownerIds.has(otherId) || childIds.has(otherId))
    })
  })
  return [...children, ...external]
}

function labelForScope(project: C4Project, scope: Scope, locale: Locale = 'en') {
  if (!scope.scopeId) return copy[locale].projectRoot
  return project.elements[scope.scopeId]?.name ?? (locale === 'ja' ? '不明なスコープ' : 'Unknown scope')
}

function resolveVisibleEndpoint(project: C4Project, id: string, visibleIds: Set<string>) {
  if (visibleIds.has(id)) return id
  let element = project.elements[id]
  while (element?.parentId) {
    if (visibleIds.has(element.parentId)) return element.parentId
    element = project.elements[element.parentId]
  }
  return undefined
}

function relationshipLines(project: C4Project, elements: C4Element[], scope: Scope) {
  const ids = new Set(elements.map((element) => element.id))
  if (scope.level === 'context') {
    return Object.values(project.relationships).filter((relationship) => ids.has(relationship.sourceId) && ids.has(relationship.targetId))
  }
  return Object.values(project.relationships).flatMap((relationship) => {
    const endpoints = relationship.viewEndpoints?.[scope.level]
    const sourceId = endpoints?.sourceId ?? relationship.sourceId
    const targetId = endpoints?.targetId ?? relationship.targetId
    const visibleSourceId = resolveVisibleEndpoint(project, sourceId, ids)
    const visibleTargetId = resolveVisibleEndpoint(project, targetId, ids)
    if (!visibleSourceId || !visibleTargetId || visibleSourceId === visibleTargetId) return []
    return [{ ...relationship, sourceId: visibleSourceId, targetId: visibleTargetId }]
  })
}

function renderNodes(project: C4Project, elements: C4Element[], scope: Scope): RenderNode[] {
  const positions = getDiagramLayout(project, scope).nodePositions ?? {}
  return elements.map((element) => {
    const storedPosition = positions[element.id]
    if (storedPosition) return { element, x: storedPosition.x, y: storedPosition.y, isExternal: scope.level !== 'context' && (element.kind === 'person' || element.kind === 'externalSystem') }
    if (scope.level === 'context') return { element, x: element.position.x, y: element.position.y, isExternal: false }
    if (element.kind === 'person') return { element, x: element.position.x, y: element.position.y, isExternal: true }
    if (element.kind === 'externalSystem') return { element, x: 960, y: element.position.y, isExternal: true }
    return { element, x: 300 + element.position.x * 0.55, y: element.position.y, isExternal: false }
  })
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' })[character] ?? character)
}

function diagramTitleForScope(project: C4Project, scope: Scope, locale: Locale) {
  const viewLabel = locale === 'en' ? `${levelMeta[locale][scope.level].label} View` : `${levelMeta[locale][scope.level].label}ビュー`
  const scopeName = scope.level === 'context'
    ? Object.values(project.elements).find((element) => element.kind === 'softwareSystem' && !element.parentId)?.name ?? project.name
    : labelForScope(project, scope, locale)
  return `${viewLabel}: ${scopeName}`
}

function diagramTitleLayout(scope: Scope, nodes: RenderNode[], boundary: BoundaryRect) {
  const titleWidth = 360
  const titleHeight = 36
  const left = nodes.length ? Math.min(...nodes.map((node) => node.x)) : 24
  const nodeBottom = nodes.length ? Math.max(...nodes.map((node) => node.y + nodeHeight)) : 0
  const boundaryBottom = scope.level === 'context' ? 0 : boundary.y + boundary.height
  const titleX = Math.max(0, left)
  const titleY = Math.max(nodeBottom, boundaryBottom) + 24
  const rightMost = nodes.length ? Math.max(...nodes.map((node) => node.x + nodeWidth)) : 0
  const width = Math.max(canvasWidth, rightMost + 24, boundary.x + boundary.width + 24, titleX + titleWidth + 24)
  const height = Math.max(canvasHeight, titleY + titleHeight + 24)
  return { titleX, titleY, titleWidth, titleHeight, width, height }
}

function diagramCanvasSize(boundary: BoundaryRect, nodes: RenderNode[]) {
  const rightMost = nodes.length ? Math.max(...nodes.map((node) => node.x + nodeWidth)) : 0
  const bottomMost = nodes.length ? Math.max(...nodes.map((node) => node.y + nodeHeight)) : 0
  return {
    width: Math.max(canvasWidth, boundary.x + boundary.width + 80, rightMost + 80),
    height: Math.max(canvasHeight, boundary.y + boundary.height + 80, bottomMost + 80),
  }
}

function fileStem(project: C4Project, scope: Scope) {
  const scopeName = scope.scopeId ? project.elements[scope.scopeId]?.name : 'system-context'
  return `${project.name}-${scopeName ?? scope.level}`.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function edgePoint(id: string, side: 'source' | 'target', nodes: RenderNode[]) {
  const node = nodes.find((item) => item.element.id === id)
  if (!node) return { x: 0, y: 0 }
  return { x: side === 'source' ? node.x + nodeWidth : node.x, y: node.y + nodeHeight / 2 }
}

function buildDiagramSvg(project: C4Project, scope: Scope, locale: Locale, nodes: RenderNode[], relationships: Relationship[], boundary: BoundaryRect) {
  const title = diagramTitleForScope(project, scope, locale)
  const layout = diagramTitleLayout(scope, nodes, boundary)
  const background = '#11182b'
  const nodeFill = '#161f35'
  const boundaryMarkup = scope.level === 'context' ? '' : `<rect x="${boundary.x}" y="${boundary.y}" width="${boundary.width}" height="${boundary.height}" rx="18" fill="#55d5e608" stroke="#55d5e660" stroke-width="2" stroke-dasharray="8 6"/><text x="${boundary.x + 18}" y="${boundary.y + 28}" fill="#80e6f0" font-size="12" font-weight="700">${escapeXml(labelForScope(project, scope, locale))}</text>`
  const edges = relationships.map((relationship) => {
    const source = edgePoint(relationship.sourceId, 'source', nodes)
    const target = edgePoint(relationship.targetId, 'target', nodes)
    const middle = source.x + (target.x - source.x) / 2
    return `<path d="M ${source.x} ${source.y} C ${middle} ${source.y}, ${middle} ${target.y}, ${target.x} ${target.y}" stroke="#7180a0" stroke-width="1.5" fill="none" marker-end="url(#arrow)"/><text x="${middle}" y="${(source.y + target.y) / 2 - 7}" fill="#a1aec7" text-anchor="middle" font-size="10">${escapeXml(relationship.label)}</text>`
  }).join('')
  const nodeMarkup = nodes.map(({ element, x, y, isExternal }) => {
    const stroke = isExternal ? '#a68bfa' : element.kind === 'component' ? '#a68bfa' : '#55d5e6'
    const kind = elementRoleLabel(element, locale)
    return `<g><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" fill="${nodeFill}" stroke="${stroke}" stroke-width="2"/><text x="${x + 14}" y="${y + 27}" fill="#e8eefc" font-size="14" font-weight="700">${escapeXml(element.name)}</text><text x="${x + 14}" y="${y + 45}" fill="${stroke}" font-size="9" font-weight="700" letter-spacing="1">${escapeXml(kind.toUpperCase())}</text><text x="${x + 14}" y="${y + 70}" fill="#9aa8c3" font-size="11">${escapeXml(element.description.slice(0, 34))}</text><text x="${x + 14}" y="${y + 96}" fill="#7786a5" font-size="10">${escapeXml(element.technology)}</text></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#7180a012" stroke-width="1"/></pattern><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#7180a0"/></marker></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" fill="url(#grid)"/>${boundaryMarkup}${edges}${nodeMarkup}<rect x="${layout.titleX}" y="${layout.titleY}" width="${layout.titleWidth}" height="${layout.titleHeight}" rx="8" fill="#0b1020" stroke="#32405f"/><text x="${layout.titleX + 14}" y="${layout.titleY + 23}" fill="#e8eefc" font-size="13" font-weight="700">${escapeXml(title)}</text></svg>`
}

function buildDrawioXml(project: C4Project, scope: Scope, locale: Locale, nodes: RenderNode[], relationships: Relationship[], boundary: BoundaryRect) {
  const scopeName = labelForScope(project, scope, locale)
  const layout = diagramTitleLayout(scope, nodes, boundary)
  const parentId = '1'
  const boundaryId = 'current-boundary'
  const boundaryCell = scope.level === 'context' ? '' : `<mxCell id="${boundaryId}" value="${escapeXml(scopeName)}" style="rounded=1;dashed=1;whiteSpace=wrap;html=1;strokeColor=#55d5e6;fillColor=#e8fbff;fillOpacity=6;fontColor=#55d5e6;verticalAlign=top;align=left;spacingTop=10;spacingLeft=14;" vertex="1" parent="${parentId}"><mxGeometry x="${boundary.x}" y="${boundary.y}" width="${boundary.width}" height="${boundary.height}" as="geometry"/></mxCell>`
  const cells = nodes.map(({ element, x, y, isExternal }) => {
    const stroke = isExternal ? '#a68bfa' : element.kind === 'component' ? '#a68bfa' : '#55d5e6'
    const value = `${escapeXml(element.name)}&lt;br&gt;&lt;font style=&quot;font-size:9px&quot;&gt;${escapeXml(elementRoleLabel(element, locale))}&lt;/font&gt;`
    return `<mxCell id="${escapeXml(element.id)}" value="${value}" style="rounded=1;whiteSpace=wrap;html=1;strokeColor=${stroke};fillColor=#161f35;fontColor=#e8eefc;" vertex="1" parent="${parentId}"><mxGeometry x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" as="geometry"/></mxCell>`
  }).join('')
  const edges = relationships.map((relationship) => {
    const sourceNode = nodes.find((node) => node.element.id === relationship.sourceId)
    const targetNode = nodes.find((node) => node.element.id === relationship.targetId)
    if (!sourceNode || !targetNode) return ''
    const source = sourceNode.element.id
    const target = targetNode.element.id
    return `<mxCell id="edge-${escapeXml(relationship.id)}" value="${escapeXml(relationship.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#7180a0;" edge="1" parent="${parentId}" source="${escapeXml(source)}" target="${escapeXml(target)}"><mxGeometry relative="1" as="geometry"/></mxCell>`
  }).join('')
  const title = `<mxCell id="diagram-title" value="${escapeXml(diagramTitleForScope(project, scope, locale))}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontColor=#e8eefc;fontStyle=1;" vertex="1" parent="${parentId}"><mxGeometry x="${layout.titleX}" y="${layout.titleY}" width="${layout.titleWidth}" height="${layout.titleHeight}" as="geometry"/></mxCell>`
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="archidiag"><diagram name="${escapeXml(levelMeta[locale][scope.level].label)}"><mxGraphModel dx="${layout.width}" dy="${layout.height}" grid="1" gridSize="10" page="0"><root><mxCell id="0"/><mxCell id="${parentId}" parent="0"/>${boundaryCell}${cells}${edges}${title}</root></mxGraphModel></diagram></mxfile>`
}

function useProjectHistory(initial: C4Project) {
  const [project, setProject] = useState(initial)
  const [past, setPast] = useState<C4Project[]>([])
  const [future, setFuture] = useState<C4Project[]>([])

  const update = useCallback((mutator: (current: C4Project) => C4Project) => {
    setProject((current) => {
      const next = mutator(current)
      setPast((history) => [...history.slice(-39), current])
      setFuture([])
      return next
    })
  }, [])

  const replace = useCallback((next: C4Project) => {
    setPast([])
    setFuture([])
    setProject(next)
  }, [])

  const undo = useCallback(() => {
    setPast((history) => {
      const previous = history[history.length - 1]
      if (!previous) return history
      setFuture((redoStack) => [project, ...redoStack])
      setProject(previous)
      return history.slice(0, -1)
    })
  }, [project])

  const redo = useCallback(() => {
    setFuture((redoStack) => {
      const next = redoStack[0]
      if (!next) return redoStack
      setPast((history) => [...history, project])
      setProject(next)
      return redoStack.slice(1)
    })
  }, [project])

  return { project, update, replace, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}

function App() {
  const history = useProjectHistory(loadProject())
  const { project, update, replace, undo, redo, canUndo, canRedo } = history
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem(LOCALE_KEY) === 'ja' ? 'ja' : 'en')
  const text = copy[locale]
  const [scope, setScope] = useState<Scope>({ level: 'context', scopeId: null })
  const [selectedId, setSelectedId] = useState('system:commerce')
  const [search, setSearch] = useState('')
  const [zoom, setZoom] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newContainerCategory, setNewContainerCategory] = useState<ContainerCategory>('application')
  const [newDataStoreKind, setNewDataStoreKind] = useState<DataStoreKind>('database')
  const [notice, setNotice] = useState(() => copy[locale].allChangesSaved)
  const [webMcpReady, setWebMcpReady] = useState(false)
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null)
  const [boundaryPreview, setBoundaryPreview] = useState<BoundaryRect | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef(project)
  const scopeRef = useRef(scope)
  const dragRef = useRef<DragState | null>(null)
  const boundaryResizeRef = useRef<BoundaryResizeState | null>(null)

  useEffect(() => {
    projectRef.current = project
    scopeRef.current = scope
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  }, [project, scope])

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale)
  }, [locale])

  useEffect(() => {
    setNotice((current) => current === copy.en.allChangesSaved || current === copy.ja.allChangesSaved ? text.allChangesSaved : current)
  }, [text.allChangesSaved])

  const elements = useMemo(() => visibleElements(project, scope), [project, scope])
  const relationships = useMemo(() => relationshipLines(project, elements, scope), [project, elements, scope])
  const baseRenderNodes = useMemo(() => renderNodes(project, elements, scope), [project, elements, scope])
  const canvasNodes = useMemo(() => baseRenderNodes.map((node) => dragPreview?.id === node.element.id ? { ...node, x: dragPreview.x, y: dragPreview.y } : node), [baseRenderNodes, dragPreview])
  const selected = selectedId ? project.elements[selectedId] : undefined
  const currentScopeElement = scope.scopeId ? project.elements[scope.scopeId] : undefined
  const currentBoundary = boundaryPreview ?? getDiagramBoundary(project, scope)
  const canvasSize = useMemo(() => diagramCanvasSize(currentBoundary, canvasNodes), [currentBoundary, canvasNodes])

  const updateElement = useCallback((id: string, patch: Partial<C4Element>) => {
    update((current) => ({
      ...current,
      elements: { ...current.elements, [id]: { ...current.elements[id], ...patch } },
    }))
    setNotice(text.unsavedChanges)
  }, [text.unsavedChanges, update])

  const logWebMcpEdit = useCallback((event: {
    tool: string
    action: string
    elementId?: string
    elementKind?: ElementKind
    changes: Record<string, unknown>
  }) => {
    console.log('[WebMCP edit]', {
      timestamp: new Date().toISOString(),
      source: 'WebMCP',
      scope: scopeRef.current,
      ...event,
    })
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, node: RenderNode) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id: node.element.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const node = baseRenderNodes.find((item) => item.element.id === drag.id)
    if (!node) return
    const rawPosition = { x: Math.max(0, drag.originX + (event.clientX - drag.startX) / zoom), y: Math.max(0, drag.originY + (event.clientY - drag.startY) / zoom) }
    const nextBoundary = scope.level !== 'context' && !node.isExternal ? expandBoundaryToContain(currentBoundary, rawPosition) : currentBoundary
    const position = scope.level !== 'context' && node.isExternal ? keepOutsideBoundary(rawPosition, nextBoundary) : rawPosition
    if (nextBoundary.width !== currentBoundary.width || nextBoundary.height !== currentBoundary.height || nextBoundary.x !== currentBoundary.x || nextBoundary.y !== currentBoundary.y) setBoundaryPreview(nextBoundary)
    if (Math.abs(position.x - drag.originX) > 2 || Math.abs(position.y - drag.originY) > 2) setDragPreview({ id: drag.id, x: position.x, y: position.y })
  }

  const finishDrag = () => {
    const drag = dragRef.current
    const preview = dragPreview
    if (drag && preview && (Math.abs(preview.x - drag.originX) > 2 || Math.abs(preview.y - drag.originY) > 2)) {
      const node = baseRenderNodes.find((item) => item.element.id === drag.id)
      if (node) {
        const nextPosition = { x: Math.max(0, preview.x), y: Math.max(0, preview.y) }
        const key = scopeLayoutKey(scope)
        const nextBoundary = boundaryPreview ?? currentBoundary
        const positionedNodes = baseRenderNodes.map((item) => item.element.id === drag.id ? { ...item, x: nextPosition.x, y: nextPosition.y } : item)
        const externalAdjustments = scope.level === 'context' ? {} : moveOverlappingExternalNodes(positionedNodes, nextBoundary, drag.id)
        update((current) => ({
          ...current,
          layouts: {
            ...current.layouts,
            [key]: {
              ...current.layouts?.[key],
              ...(boundaryPreview ? { boundary: nextBoundary } : {}),
              nodePositions: { ...current.layouts?.[key]?.nodePositions, [drag.id]: nextPosition, ...externalAdjustments },
            },
          },
        }))
        setNotice(text.unsavedChanges)
      }
    }
    dragRef.current = null
    setDragPreview(null)
    setBoundaryPreview(null)
  }

  const handleBoundaryPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || scope.level === 'context') return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    boundaryResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originWidth: currentBoundary.width, originHeight: currentBoundary.height }
  }

  const handleBoundaryPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = boundaryResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const width = Math.max(420, resize.originWidth + (event.clientX - resize.startX) / zoom)
    const height = Math.max(300, resize.originHeight + (event.clientY - resize.startY) / zoom)
    setBoundaryPreview({ ...currentBoundary, width, height })
  }

  const finishBoundaryResize = () => {
    const resize = boundaryResizeRef.current
    const preview = boundaryPreview
    if (resize && preview && (preview.width !== resize.originWidth || preview.height !== resize.originHeight)) {
      const key = scopeLayoutKey(scope)
      const externalAdjustments = moveOverlappingExternalNodes(baseRenderNodes, preview)
      update((current) => ({
        ...current,
        layouts: { ...current.layouts, [key]: { ...current.layouts?.[key], boundary: preview, nodePositions: { ...current.layouts?.[key]?.nodePositions, ...externalAdjustments } } },
      }))
      setNotice(text.unsavedChanges)
    }
    boundaryResizeRef.current = null
    setBoundaryPreview(null)
  }

  const selectElement = (id: string) => setSelectedId(id)

  const enterElement = (element: C4Element) => {
    if (scope.level === 'context' && element.kind === 'softwareSystem') {
      setScope({ level: 'container', scopeId: element.id })
      setSelectedId(Object.values(project.elements).find((item) => item.parentId === element.id)?.id ?? '')
      return
    }
    if (scope.level === 'container' && element.kind === 'container') {
      setScope({ level: 'component', scopeId: element.id })
      setSelectedId(Object.values(project.elements).find((item) => item.parentId === element.id)?.id ?? '')
    }
  }

  const goToScope = (nextScope: Scope) => {
    setScope(nextScope)
    const nextElements = visibleElements(project, nextScope)
    setSelectedId(nextElements[0]?.id ?? '')
  }

  const goToElementScope = (element: C4Element) => {
    if (element.kind === 'softwareSystem') goToScope({ level: 'container', scopeId: element.id })
    if (element.kind === 'container') goToScope({ level: 'component', scopeId: element.id })
  }

  const addElement = () => {
    const name = newName.trim() || `${text.new} ${levelMeta[locale][scope.level].short}`
    const id = `${kindForLevel(scope.level)}:${crypto.randomUUID().slice(0, 8)}`
    const offset = elements.length % 3
    const element: C4Element = {
      id,
      kind: kindForLevel(scope.level),
      name,
      description: newDescription.trim() || 'Describe this element.',
      technology: scope.level === 'context' ? 'Software system' : 'Add technology',
      parentId: scope.level === 'context' ? undefined : scope.scopeId ?? undefined,
      position: { x: 90 + offset * 290, y: 130 + (elements.length % 2) * 180 },
      ...(scope.level === 'container' ? {
        containerCategory: newContainerCategory,
        ...(newContainerCategory === 'dataStore' ? { dataStoreKind: newDataStoreKind } : {}),
      } : {}),
    }
    update((current) => ({ ...current, elements: { ...current.elements, [id]: element } }))
    setSelectedId(id)
    setShowAdd(false)
    setNewName('')
    setNewDescription('')
    setNewContainerCategory('application')
    setNewDataStoreKind('database')
    setNotice(`${elementRoleLabel(element, locale)}${text.elementAdded}`)
  }

  const deleteSelected = () => {
    if (!selected) return
    const childIds = Object.values(project.elements).filter((element) => element.parentId === selected.id).map((element) => element.id)
    const idsToDelete = new Set([selected.id, ...childIds])
    update((current) => {
      const nextElements = Object.fromEntries(Object.entries(current.elements).filter(([id]) => !idsToDelete.has(id)))
      const nextRelationships = Object.fromEntries(Object.entries(current.relationships).filter(([, relation]) => !idsToDelete.has(relation.sourceId) && !idsToDelete.has(relation.targetId)))
      return { ...current, elements: nextElements, relationships: nextRelationships }
    })
    setSelectedId('')
    setNotice(childIds.length ? `${selected.name} ${childIds.length}${text.elementsDeleted}` : `${selected.name}${text.elementDeleted}`)
  }

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice(text.projectExported)
  }

  const exportCurrentDiagram = async (format: ExportFormat) => {
    setShowExportMenu(false)
    const stem = fileStem(project, scope)
    const svg = buildDiagramSvg(project, scope, locale, baseRenderNodes, relationships, currentBoundary)
    const layout = diagramTitleLayout(scope, baseRenderNodes, currentBoundary)
    try {
      if (format === 'json') {
        exportProject()
        return
      }
      if (format === 'svg') {
        downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${stem}.svg`)
      }
      if (format === 'drawio') {
        const drawio = buildDrawioXml(project, scope, locale, baseRenderNodes, relationships, currentBoundary)
        downloadBlob(new Blob([drawio], { type: 'application/xml;charset=utf-8' }), `${stem}.drawio`)
      }
      if (format === 'png') {
        await new Promise<void>((resolve, reject) => {
          const image = new Image()
          image.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = layout.width * 2
            canvas.height = layout.height * 2
            const context = canvas.getContext('2d')
            if (!context) return reject(new Error('Canvas unavailable'))
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            canvas.toBlob((blob) => {
              if (!blob) return reject(new Error('PNG unavailable'))
              downloadBlob(blob, `${stem}.png`)
              resolve()
            }, 'image/png')
          }
          image.onerror = () => reject(new Error('SVG render failed'))
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        })
      }
      if (format === 'pdf') {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [layout.width, layout.height] })
        pdf.setFillColor(17, 24, 43)
        pdf.rect(0, 0, layout.width, layout.height, 'F')
        if (scope.level !== 'context') {
          pdf.setDrawColor(85, 213, 230)
          pdf.setLineDashPattern([6, 5], 0)
          pdf.roundedRect(currentBoundary.x, currentBoundary.y, currentBoundary.width, currentBoundary.height, 12, 12)
          pdf.setLineDashPattern([], 0)
          pdf.setTextColor(128, 230, 240)
          pdf.setFontSize(12)
          pdf.text(labelForScope(project, scope, locale), currentBoundary.x + 18, currentBoundary.y + 26)
        }
        pdf.setDrawColor(113, 128, 160)
        pdf.setTextColor(161, 174, 199)
        pdf.setFontSize(9)
        relationships.forEach((relationship) => {
          const source = edgePoint(relationship.sourceId, 'source', baseRenderNodes)
          const target = edgePoint(relationship.targetId, 'target', baseRenderNodes)
          pdf.line(source.x, source.y, target.x, target.y)
          pdf.text(relationship.label, (source.x + target.x) / 2 - 18, (source.y + target.y) / 2 - 4)
        })
        baseRenderNodes.forEach(({ element, x, y, isExternal }) => {
          const stroke = isExternal ? [166, 139, 250] : element.kind === 'component' ? [166, 139, 250] : [85, 213, 230]
          pdf.setDrawColor(stroke[0], stroke[1], stroke[2])
          pdf.setFillColor(22, 31, 53)
          pdf.roundedRect(x, y, nodeWidth, nodeHeight, 10, 10, 'FD')
          pdf.setTextColor(232, 238, 252)
          pdf.setFontSize(13)
          pdf.text(element.name.slice(0, 26), x + 14, y + 26)
          pdf.setTextColor(stroke[0], stroke[1], stroke[2])
          pdf.setFontSize(8)
          pdf.text(elementRoleLabel(element, locale).toUpperCase(), x + 14, y + 43)
          pdf.setTextColor(154, 168, 195)
          pdf.setFontSize(9)
          pdf.text(element.description.slice(0, 34), x + 14, y + 68)
          pdf.setTextColor(119, 134, 165)
          pdf.text(element.technology.slice(0, 28), x + 14, y + 94)
        })
        pdf.setFillColor(11, 16, 32)
        pdf.setDrawColor(50, 64, 95)
        pdf.roundedRect(layout.titleX, layout.titleY, layout.titleWidth, layout.titleHeight, 8, 8, 'FD')
        pdf.setTextColor(232, 238, 252)
        pdf.setFontSize(13)
        pdf.text(diagramTitleForScope(project, scope, locale), layout.titleX + 14, layout.titleY + 23)
        pdf.save(`${stem}.pdf`)
      }
      const labels: Record<ExportFormat, string> = { json: text.exportJson, pdf: text.exportPdf, drawio: text.exportDrawio, png: text.exportPng, svg: text.exportSvg }
      setNotice(`${text.exportComplete} ${labels[format]}`)
    } catch {
      setNotice(text.exportFailed)
    }
  }

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as C4Project
      if (!parsed.id || !parsed.name || !parsed.elements || !parsed.relationships) throw new Error('Invalid project')
      replace(parsed)
      setScope({ level: 'context', scopeId: null })
      setSelectedId(Object.keys(parsed.elements)[0] ?? '')
      setNotice(text.projectImported)
    } catch {
      setNotice(text.importFailed)
    } finally {
      event.target.value = ''
    }
  }

  const validate = () => {
    const errors = Object.values(project.elements).filter((element) => !element.name.trim()).length
    const brokenLinks = Object.values(project.relationships).filter((relation) => !project.elements[relation.sourceId] || !project.elements[relation.targetId]).length
    setNotice(errors || brokenLinks ? `${errors + brokenLinks}${text.validationIssues}` : text.validModel)
  }

  useEffect(() => {
    const documentWithModelContext = document as Document & { modelContext?: { registerTool: (tool: { name: string; title: string; description: string; inputSchema: unknown; execute: (input: Record<string, unknown>) => unknown }, options?: { signal?: AbortSignal }) => Promise<void> } }
    const modelContext = documentWithModelContext.modelContext
    if (!modelContext) return
    const controller = new AbortController()
    const tools = [
      {
        name: 'get_project_summary',
        title: 'Get project summary',
        description: 'Read the current C4 project name, scope, and element counts.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: () => ({ project: projectRef.current.name, level: scopeRef.current.level, scope: labelForScope(projectRef.current, scopeRef.current), elementCount: Object.keys(projectRef.current.elements).length }),
      },
      {
        name: 'get_scope',
        title: 'Get current scope',
        description: 'Read the current C4 diagram scope and its visible elements.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: () => ({ level: scopeRef.current.level, scopeId: scopeRef.current.scopeId, scopeName: labelForScope(projectRef.current, scopeRef.current), elements: visibleElements(projectRef.current, scopeRef.current).map(({ id, kind, name, description, containerCategory, dataStoreKind }) => ({ id, kind, name, description, ...(kind === 'container' ? { containerCategory, dataStoreKind } : {}) })) }),
      },
      {
        name: 'enter_scope',
        title: 'Enter child scope',
        description: 'Open the container scope for a software system or the component scope for a container.',
        inputSchema: { type: 'object', properties: { elementId: { type: 'string' } }, required: ['elementId'], additionalProperties: false },
        execute: (input: Record<string, unknown>) => {
          const element = projectRef.current.elements[String(input.elementId)]
          if (!element || !kindMeta[element.kind].canEnter) return { ok: false, error: 'Element does not own a child scope' }
          if (element.kind === 'softwareSystem') setScope({ level: 'container', scopeId: element.id })
          if (element.kind === 'container') setScope({ level: 'component', scopeId: element.id })
          return { ok: true, scopeId: element.id, name: element.name }
        },
      },
      {
        name: 'rename_element',
        title: 'Rename model element',
        description: 'Propose a name change for one canonical C4 element. The change updates every linked view.',
        inputSchema: { type: 'object', properties: { elementId: { type: 'string' }, name: { type: 'string' } }, required: ['elementId', 'name'], additionalProperties: false },
        execute: (input: Record<string, unknown>) => {
          const elementId = String(input.elementId)
          const name = String(input.name).trim()
          const before = projectRef.current.elements[elementId]
          if (!before || !name) return { ok: false, error: 'Element or name is invalid' }
          updateElement(elementId, { name })
          logWebMcpEdit({
            tool: 'rename_element',
            action: 'rename',
            elementId,
            elementKind: before.kind,
            changes: { name: { from: before.name, to: name } },
          })
          return { ok: true, elementId, name, note: 'All diagram views resolve this canonical name.' }
        },
      },
    ]
    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).then(() => setWebMcpReady(true)).catch(() => setWebMcpReady(false))
    return () => controller.abort()
  }, [logWebMcpEdit, updateElement])

  const ancestorTrail = useMemo(() => {
    const trail: Array<{ label: string; scope: Scope }> = [{ label: levelMeta[locale].context.label, scope: { level: 'context', scopeId: null } }]
    if (scope.level === 'container' && scope.scopeId) trail.push({ label: project.elements[scope.scopeId]?.name ?? 'System', scope })
    if (scope.level === 'component' && scope.scopeId) {
      const container = project.elements[scope.scopeId]
      const system = container?.parentId ? project.elements[container.parentId] : undefined
      if (system) trail.push({ label: system.name, scope: { level: 'container', scopeId: system.id } })
      trail.push({ label: container?.name ?? 'Container', scope })
    }
    return trail
  }, [locale, project, scope])

  const filteredTree = Object.values(project.elements).filter((element) => !search || `${element.name} ${element.description}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div data-theme="archidiag" className="min-h-screen bg-ink text-base-content">
      <header className="flex h-[72px] items-center justify-between border-b border-line/80 bg-ink/90 px-6 backdrop-blur">
        <div className="flex items-center gap-9">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan text-ink shadow-[0_0_28px_rgba(85,213,230,.35)]"><Icon name="layers" size={19} stroke={2.2} /></div>
            <div><div className="text-[15px] font-bold tracking-wide">ARCHIDIAG</div><div className="text-[10px] uppercase tracking-[0.2em] text-muted">{text.studio}</div></div>
          </div>
          <div className="hidden h-8 w-px bg-line md:block" />
          <div className="flex items-center gap-2 text-sm text-muted"><Icon name="folder" size={15} /><span>{project.name}</span><span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted">{text.local}</span></div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`hidden items-center gap-2 rounded-lg border px-3 py-2 text-xs md:flex ${webMcpReady ? 'border-cyan/30 bg-cyan/5 text-cyan' : 'border-line bg-panel/60 text-muted'}`}><span className={`h-1.5 w-1.5 rounded-full ${webMcpReady ? 'bg-cyan shadow-[0_0_8px_#55d5e6]' : 'bg-muted'}`} />{webMcpReady ? text.webmcpReady : text.manualMode}</div>
          <div className="join border border-line bg-panel/60"><button onClick={() => setLocale('en')} className={`btn btn-ghost btn-xs join-item ${locale === 'en' ? 'bg-cyan/15 text-cyan' : 'text-muted'}`} aria-label="English">EN</button><button onClick={() => setLocale('ja')} className={`btn btn-ghost btn-xs join-item ${locale === 'ja' ? 'bg-cyan/15 text-cyan' : 'text-muted'}`} aria-label="日本語">JP</button></div>
          <button className="btn btn-ghost btn-sm text-muted hover:bg-white/5 hover:text-base-content" onClick={validate}><Icon name="check" size={15} /> {text.validate}</button>
          <button className="btn btn-ghost btn-sm text-muted hover:bg-white/5 hover:text-base-content" onClick={() => fileInputRef.current?.click()}><Icon name="upload" size={15} /> {text.import}</button>
          <div className="relative"><button className="btn btn-primary btn-sm px-4 text-ink" onClick={() => setShowExportMenu((value) => !value)}><Icon name="download" size={15} /> {text.exportMenu}<Icon name="chevronDown" size={13} /></button>{showExportMenu && <div className="absolute right-0 top-11 z-40 w-44 rounded-xl border border-line bg-panel p-1.5 shadow-glow"><button onClick={() => exportCurrentDiagram('json')} className="flex w-full rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">{text.exportJson}</button><button onClick={() => exportCurrentDiagram('pdf')} className="flex w-full rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">{text.exportPdf}</button><button onClick={() => exportCurrentDiagram('drawio')} className="flex w-full rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">{text.exportDrawio}</button><button onClick={() => exportCurrentDiagram('png')} className="flex w-full rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">{text.exportPng}</button><button onClick={() => exportCurrentDiagram('svg')} className="flex w-full rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">{text.exportSvg}</button></div>}</div>
          <input ref={fileInputRef} onChange={importProject} type="file" accept="application/json,.json" className="hidden" />
        </div>
      </header>

      <main className="grid h-[calc(100vh-72px)] grid-cols-[248px_minmax(700px,1fr)_306px]">
        <aside className="flex min-h-0 flex-col border-r border-line/80 bg-panel/45">
          <div className="border-b border-line/80 p-4">
            <div className="mb-3 flex items-center justify-between"><div className="section-label">{text.projectExplorer}</div><button className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-cyan" onClick={() => setShowAdd(true)} title={text.addElement}><Icon name="plus" size={16} /></button></div>
            <label className="flex items-center gap-2 rounded-lg border border-line bg-ink/45 px-2.5 py-2 text-xs text-muted focus-within:border-cyan/60"><Icon name="search" size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.searchModel} className="w-full bg-transparent outline-none placeholder:text-muted/60" /></label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-base-content"><Icon name="folder" size={15} className="text-cyan" />{project.name}</div>
            <button onClick={() => goToScope({ level: 'context', scopeId: null })} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${scope.level === 'context' ? 'bg-cyan/10 text-cyan' : 'text-muted hover:bg-white/5 hover:text-base-content'}`}><Icon name="grid" size={14} />{text.systemContext} <span className="ml-auto text-[10px] opacity-60">⌘1</span></button>
            <div className="ml-3 border-l border-line pl-2">
              {filteredTree.filter((element) => element.kind === 'softwareSystem').map((system) => (
                <div key={system.id} className="mb-1">
                  <button onClick={() => goToElementScope(system)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${scope.scopeId === system.id ? 'bg-cyan/10 text-cyan' : 'text-muted hover:bg-white/5 hover:text-base-content'}`}><Icon name="globe" size={14} /> <span className="truncate">{system.name}</span><Icon name="chevron" size={13} className="ml-auto opacity-50" /></button>
                  <div className="ml-3 border-l border-line/70 pl-2">
                    {filteredTree.filter((element) => element.parentId === system.id).map((container) => (
                      <div key={container.id}>
                        <button onClick={() => goToElementScope(container)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${scope.scopeId === container.id ? 'bg-violet/10 text-violet' : 'text-muted hover:bg-white/5 hover:text-base-content'}`}><Icon name="box" size={13} /><span className="truncate">{container.name}</span><Icon name="chevron" size={13} className="ml-auto opacity-50" /></button>
                        {scope.scopeId === container.id && <div className="ml-3 border-l border-line/60 pl-2">{filteredTree.filter((element) => element.parentId === container.id).map((component) => <button key={component.id} onClick={() => selectElement(component.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] ${selectedId === component.id ? 'text-violet' : 'text-muted hover:text-base-content'}`}><span className="h-1.5 w-1.5 rounded-full bg-violet" /><span className="truncate">{component.name}</span></button>)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 px-2"><div className="section-label mb-2">{text.modelNotes}</div><div className="rounded-lg border border-line/70 bg-ink/35 p-3 text-[11px] leading-5 text-muted">{text.modelNote}</div></div>
          </div>
          <div className="border-t border-line/80 p-3"><div className="flex items-center gap-2 rounded-lg bg-ink/40 px-3 py-2.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.6)]" />{notice}</div></div>
        </aside>

        <section className="flex min-w-0 flex-col bg-ink/35">
          <div className="flex h-[76px] items-center justify-between border-b border-line/80 px-6">
            <div><div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>{text.project}</span>{ancestorTrail.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="flex items-center gap-2"><Icon name="chevron" size={12} /><button className={index === ancestorTrail.length - 1 ? 'text-base-content' : 'hover:text-cyan'} onClick={() => goToScope(crumb.scope)}>{crumb.label}</button></span>)}</div><div className="flex items-center gap-3"><h1 className="text-xl font-semibold tracking-tight">{levelMeta[locale][scope.level].label}</h1><span className="rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">{elements.length} {locale === 'ja' ? '要素' : 'elements'}</span></div></div>
            <div className="flex items-center gap-2"><div className="join border border-line bg-panel/60"><button className="btn btn-ghost btn-xs join-item text-muted hover:bg-white/5" disabled={!canUndo} onClick={undo} title={text.undo} aria-label={text.undo}><Icon name="undo" size={14} /></button><button className="btn btn-ghost btn-xs join-item text-muted hover:bg-white/5" disabled={!canRedo} onClick={redo} title={text.redo} aria-label={text.redo}><Icon name="redo" size={14} /></button></div><div className="h-5 w-px bg-line" /><button onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.1).toFixed(1))))} className="btn btn-ghost btn-xs text-muted">−</button><span className="w-10 text-center text-xs text-muted">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(1.3, Number((value + 0.1).toFixed(1))))} className="btn btn-ghost btn-xs text-muted">+</button></div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-5">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-sm text-muted">{levelMeta[locale][scope.level].description}{currentScopeElement ? ` · ${currentScopeElement.name}` : ''}</p></div><div className="flex items-center gap-2"><span className="flex items-center gap-1.5 rounded-full border border-line bg-panel/70 px-2.5 py-1.5 text-[10px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-cyan" /> {text.syncedLocally}</span><button onClick={() => setShowAdd(true)} className="btn btn-sm btn-primary gap-1.5 text-ink"><Icon name="plus" size={15} /> {text.addElement}</button></div></div>
            <div className="canvas-grid relative min-h-0 flex-1 overflow-auto rounded-2xl border border-line shadow-glow">
              <div className="relative" style={{ width: canvasSize.width * zoom, height: canvasSize.height * zoom }}>
                <div className="absolute left-0 top-0" style={{ width: canvasSize.width, height: canvasSize.height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                  <div className="absolute left-5 top-5 rounded-lg border border-line/80 bg-panel/80 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted backdrop-blur">{levelMeta[locale][scope.level].label} · {labelForScope(project, scope, locale)}</div>
                  {scope.level !== 'context' && <div className="pointer-events-none absolute rounded-2xl border-2 border-dashed border-cyan/35 bg-cyan/[0.025]" style={{ left: currentBoundary.x, top: currentBoundary.y, width: currentBoundary.width, height: currentBoundary.height }}><div className="absolute left-4 top-3 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan/75">{text.systemBoundary} · {currentScopeElement?.name}</div><div role="button" aria-label={locale === 'ja' ? 'システム境界のサイズを変更' : 'Resize system boundary'} title={locale === 'ja' ? 'ドラッグして境界のサイズを変更' : 'Drag to resize boundary'} className="pointer-events-auto absolute bottom-2 right-2 h-5 w-5 cursor-se-resize rounded-md border border-cyan/50 bg-cyan/15" onPointerDown={handleBoundaryPointerDown} onPointerMove={handleBoundaryPointerMove} onPointerUp={finishBoundaryResize} onPointerCancel={finishBoundaryResize}><span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-cyan" /></div></div>}
                  <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" width={canvasSize.width} height={canvasSize.height}>
                    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#7180a0" /></marker></defs>
                    {relationships.map((relationship) => {
                      const source = edgePoint(relationship.sourceId, 'source', canvasNodes)
                      const target = edgePoint(relationship.targetId, 'target', canvasNodes)
                      const middle = source.x + (target.x - source.x) / 2
                      return <g key={relationship.id}><path d={`M ${source.x} ${source.y} C ${middle} ${source.y}, ${middle} ${target.y}, ${target.x} ${target.y}`} stroke="#63718f" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" /><rect x={middle - 32} y={Math.min(source.y, target.y) + Math.abs(target.y - source.y) / 2 - 10} width="64" height="20" rx="5" fill="#11182b" stroke="#283654" /><text x={middle} y={Math.min(source.y, target.y) + Math.abs(target.y - source.y) / 2 + 3} fill="#8f9bb4" textAnchor="middle" fontSize="9">{relationship.label}</text></g>
                    })}
                  </svg>
                  {canvasNodes.map((node) => {
                    const element = node.element
                    const meta = kindMeta[element.kind]
                    const isSelected = selectedId === element.id
                    const canDrag = true
                    return <button key={element.id} onClick={() => selectElement(element.id)} onDoubleClick={() => enterElement(element)} onPointerDown={(event) => handlePointerDown(event, node)} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} className={`node-shadow absolute flex flex-col rounded-xl border bg-panel/95 text-left backdrop-blur transition hover:-translate-y-0.5 ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${meta.accent} ${isSelected ? 'ring-2 ring-cyan/60 ring-offset-2 ring-offset-[#11182b]' : ''}`} style={{ left: node.x, top: node.y, width: nodeWidth, minHeight: nodeHeight }}>
                      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2.5"><span className={`grid h-7 w-7 place-items-center rounded-lg ${meta.badge}`}><Icon name={meta.icon} size={15} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-base-content">{element.name}</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted">{elementRoleLabel(element, locale)}</div></div>{node.isExternal && scope.level !== 'context' ? <span className="text-[9px] text-violet/80">{text.outsideBoundary}</span> : meta.canEnter && <span className="text-[9px] text-cyan/70">↗ {locale === 'ja' ? '移動' : 'enter'}</span>}</div>
                      <div className="flex flex-1 flex-col justify-between px-3 py-2.5"><p className="line-clamp-2 text-[11px] leading-4 text-muted">{element.description}</p><div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted/80"><span className="rounded bg-ink/60 px-1.5 py-0.5">{element.technology}</span>{meta.canEnter && <span className="ml-auto text-cyan/70">{locale === 'ja' ? 'ダブルクリック' : 'double-click'}</span>}{canDrag && <span className="ml-auto text-muted/70">{text.dragToMove}</span>}</div></div>
                    </button>
                  })}
                  {elements.length === 0 && <div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-cyan/10 text-cyan"><Icon name="layers" size={23} /></div><p className="text-sm font-medium">{locale === 'ja' ? 'このスコープは空です' : 'This scope is empty'}</p><p className="mt-1 text-xs text-muted">{locale === 'ja' ? `最初の${levelMeta[locale][scope.level].short}を追加してモデルを始めましょう。` : `Add the first ${levelMeta[locale][scope.level].short.toLowerCase()} to start modeling.`}</p></div></div>}
                </div>
              </div>
              <div className="pointer-events-none absolute bottom-4 left-4 z-20 min-w-[250px] rounded-xl border border-line bg-ink/90 px-4 py-3 text-sm font-semibold text-base-content shadow-xl backdrop-blur">{diagramTitleForScope(project, scope, locale)}</div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted"><div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan" /> {text.doubleClickToEnter}</span><span className="flex items-center gap-1.5"><Icon name="link" size={12} /> {text.relationshipsUpdate}</span></div><span>{text.canvasSaved}</span></div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-line/80 bg-panel/45">
          <div className="border-b border-line/80 px-5 py-5"><div className="flex items-center justify-between"><div className="section-label">{text.inspector}</div><button className="text-muted hover:text-base-content" title={text.moreInspector}><Icon name="more" size={17} /></button></div><h2 className="mt-3 truncate text-lg font-semibold">{selected?.name ?? text.nothingSelected}</h2><p className="mt-1 text-xs leading-5 text-muted">{selected ? text.canonicalElement : text.selectNodeHint}</p></div>
          {selected ? <div className="min-h-0 flex-1 overflow-y-auto p-5"><div className={`mb-5 flex items-center gap-2 rounded-lg border bg-ink/40 px-3 py-2.5 text-xs ${kindMeta[selected.kind].accent}`}><Icon name={kindMeta[selected.kind].icon} size={15} /><span className="font-medium">{elementRoleLabel(selected, locale)}</span><span className="ml-auto font-mono text-[10px] text-muted">{selected.id}</span></div><div className="space-y-5"><label className="block"><span className="section-label mb-2 block">{text.name}</span><input className="inspector-input" value={selected.name} onChange={(event) => updateElement(selected.id, { name: event.target.value })} /></label><label className="block"><span className="section-label mb-2 block">{text.description}</span><textarea className="inspector-input min-h-[112px] resize-y leading-5" value={selected.description} onChange={(event) => updateElement(selected.id, { description: event.target.value })} /></label><label className="block"><span className="section-label mb-2 block">{text.technology}</span><input className="inspector-input" value={selected.technology} onChange={(event) => updateElement(selected.id, { technology: event.target.value })} /></label>{selected.kind === 'container' && <><label className="block"><span className="section-label mb-2 block">{text.containerCategory}</span><select className="inspector-input" value={selected.containerCategory ?? 'application'} onChange={(event) => { const category = event.target.value as ContainerCategory; updateElement(selected.id, { containerCategory: category, dataStoreKind: category === 'dataStore' ? (selected.dataStoreKind ?? 'database') : undefined }) }}><option value="application">{text.applicationContainer}</option><option value="dataStore">{text.dataStore}</option></select></label>{(selected.containerCategory ?? 'application') === 'dataStore' && <label className="block"><span className="section-label mb-2 block">{text.dataStoreKind}</span><select className="inspector-input" value={selected.dataStoreKind ?? 'database'} onChange={(event) => updateElement(selected.id, { dataStoreKind: event.target.value as DataStoreKind })}><option value="database">{text.database}</option><option value="databaseSchema">{text.databaseSchema}</option><option value="pubSub">{text.pubSub}</option><option value="other">{text.other}</option></select></label>}</>}<div><span className="section-label mb-2 block">{text.parentScope}</span><div className="flex items-center gap-2 rounded-lg border border-line bg-ink/40 px-3 py-2.5 text-xs text-muted"><Icon name="layers" size={14} />{selected.parentId ? project.elements[selected.parentId]?.name : text.projectRoot}{selected.parentId && <button className="ml-auto text-cyan hover:underline" onClick={() => goToElementScope(project.elements[selected.parentId!])}>{text.open}</button>}</div></div><div className="rounded-lg border border-cyan/20 bg-cyan/5 p-3 text-[11px] leading-5 text-cyan/80"><div className="mb-1 flex items-center gap-2 font-semibold"><Icon name="spark" size={14} /> {text.singleSource}</div>{text.singleSourceHint}</div></div><div className="mt-8 border-t border-line pt-4"><button onClick={deleteSelected} className="btn btn-ghost btn-sm w-full justify-start gap-2 text-error hover:bg-error/10"><Icon name="trash" size={14} /> {text.deleteElement}{Object.values(project.elements).some((element) => element.parentId === selected.id) ? text.deleteAndChildren : ''}</button></div></div> : <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet/10 text-violet"><Icon name="layers" size={22} /></div><p className="text-sm font-medium">{text.selectNode}</p><p className="mt-2 text-xs leading-5 text-muted">{text.selectNodeHint}</p></div>}
          <div className="border-t border-line/80 p-4"><div className="mb-2 flex items-center justify-between"><span className="section-label">{text.collaboration}</span><span className="rounded-full bg-amber/10 px-2 py-0.5 text-[10px] text-amber">{text.comingNext}</span></div><div className="flex items-center gap-2 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-muted" /> {text.localOnly}</div><button className="btn btn-ghost btn-xs mt-3 w-full border border-line text-muted hover:bg-white/5 hover:text-base-content"><Icon name="command" size={13} /> {text.connectService}</button></div>
        </aside>
      </main>

      {showAdd && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-6 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-glow"><div className="flex items-start justify-between"><div><div className="section-label">{text.new} {levelMeta[locale][scope.level].short}</div><h2 className="mt-2 text-xl font-semibold">{text.addTo} {labelForScope(project, scope, locale)}</h2><p className="mt-1 text-xs text-muted">{text.linkedToCurrent}</p></div><button onClick={() => setShowAdd(false)} className="btn btn-circle btn-ghost btn-sm text-muted">×</button></div><div className="mt-6 space-y-4"><label className="block"><span className="section-label mb-2 block">{text.name}</span><input autoFocus className="inspector-input" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addElement()} placeholder={locale === 'ja' ? text.namePlaceholder : `e.g. ${scope.level === 'context' ? 'Analytics Platform' : scope.level === 'container' ? 'Reporting API' : 'Report Builder'}`} /></label><label className="block"><span className="section-label mb-2 block">{text.description}</span><textarea className="inspector-input min-h-[90px] resize-none" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder={text.responsibilityPlaceholder} /></label>{scope.level === 'container' && <><label className="block"><span className="section-label mb-2 block">{text.containerCategory}</span><select className="inspector-input" value={newContainerCategory} onChange={(event) => setNewContainerCategory(event.target.value as ContainerCategory)}><option value="application">{text.applicationContainer}</option><option value="dataStore">{text.dataStore}</option></select></label>{newContainerCategory === 'dataStore' && <label className="block"><span className="section-label mb-2 block">{text.dataStoreKind}</span><select className="inspector-input" value={newDataStoreKind} onChange={(event) => setNewDataStoreKind(event.target.value as DataStoreKind)}><option value="database">{text.database}</option><option value="databaseSchema">{text.databaseSchema}</option><option value="pubSub">{text.pubSub}</option><option value="other">{text.other}</option></select></label>}</>}</div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm text-muted">{text.cancel}</button><button onClick={addElement} className="btn btn-primary btn-sm text-ink"><Icon name="plus" size={14} /> {text.addElement}</button></div></div></div>}
    </div>
  )
}

export default App

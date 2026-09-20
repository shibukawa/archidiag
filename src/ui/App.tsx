import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { arrangeView } from '../core/arrange'
import * as commands from '../core/commands'
import { parseProject, serializeProject } from '../core/io'
import { alignBoxes, arrangeBoxes, distributeBoxes, nextFreePosition, nodeSize, spaceBoxes, type AlignMode, type ArrangeMode, type Box } from '../core/layout'
import { childViewKind, emptyProject, type DiagramView, type Element, type Position, type Project, type Rect, type Relationship, type ViewKind } from '../core/model'
import { buildRenderModel } from '../core/render'
import { commerceStarter } from '../core/starter'
import { THEMES } from '../core/theme'
import { allFindings, type Finding } from '../core/validate'
import { breadcrumb, defaultView, ensureDefaultView, viewsForScope } from '../core/views'
import { Canvas } from './Canvas'
import { Explorer } from './Explorer'
import { exportView, fileStem, type ExportFormat } from './exporters'
import { COPY, renderLabels, viewTitle, type Locale } from './i18n'
import { Icon, type IconName } from './icons'
import { Inspector } from './Inspector'
import { QuickCreate, type QuickCreateInput } from './QuickCreate'
import { useProjectHistory } from './useHistory'
import { ValidationPanel } from './ValidationPanel'
import { registerWebMcpTools } from './webmcp'

const STORAGE_KEY = 'c4sketch-project-v2'
const LEGACY_KEY = 'archidiag-project-v1'
const LOCALE_KEY = 'archidiag-locale'

function loadInitial(): Project {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (saved) return parseProject(saved)
  } catch {
    // fall through to the starter
  }
  return commerceStarter()
}

function parseHash(): { viewId?: string; select: string[] } {
  const match = window.location.hash.match(/^#\/view\/([^?]+)(?:\?(.*))?$/)
  if (!match) return { select: [] }
  const params = new URLSearchParams(match[2] ?? '')
  return { viewId: decodeURIComponent(match[1]), select: (params.get('select') ?? '').split(',').filter(Boolean) }
}

export default function App() {
  const history = useProjectHistory(loadInitial())
  const { project, projectRef, commit, replace, undo, redo, canUndo, canRedo } = history
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem(LOCALE_KEY) === 'ja' ? 'ja' : 'en'))
  const copy = COPY[locale]
  const initialHash = useMemo(parseHash, [])
  const [currentViewId, setCurrentViewId] = useState<string | null>(initialHash.viewId ?? null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialHash.select))
  const [zoom, setZoom] = useState(1)
  const [preview, setPreview] = useState<{ positions: Record<string, Position> | null; boundary: Rect | null }>({ positions: null, boundary: null })
  const [quickCreate, setQuickCreate] = useState(false)
  const [showChecks, setShowChecks] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [webMcpReady, setWebMcpReady] = useState(false)
  const lastCreated = useRef<Rect | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** A brand-new view gets the automatic layout so context lands left or right by arrow direction from the start. */
  const withInitialLayout = useCallback((state: Project, viewId: string): Project => {
    const target = state.views[viewId]
    if (!target || Object.keys(target.layout.positions).length) return state
    const arranged = arrangeView(state, target)
    return commands.setPositions(state, viewId, arranged.positions, arranged.boundary)
  }, [])

  // Resolve the current view, creating the root context view when the project has none.
  const view: DiagramView = useMemo(() => {
    const existing = currentViewId ? project.views[currentViewId] : undefined
    if (existing) return existing
    return defaultView(project, 'c4_context', null) ?? ensureDefaultView(project, 'c4_context', null).view
  }, [currentViewId, project])

  useEffect(() => {
    if (!project.views[view.id]) commit((current) => withInitialLayout(commands.upsertView(current, view), view.id))
    if (currentViewId !== view.id) setCurrentViewId(view.id)
  }, [commit, currentViewId, project.views, view, withInitialLayout])

  useEffect(() => { localStorage.setItem(STORAGE_KEY, serializeProject(project)) }, [project])
  useEffect(() => { localStorage.setItem(LOCALE_KEY, locale) }, [locale])
  useEffect(() => { if (!notice) setNotice(copy.saved) }, [copy.saved, notice])
  useEffect(() => {
    const select = [...selectedIds].join(',')
    const hash = `#/view/${encodeURIComponent(view.id)}${select ? `?select=${encodeURIComponent(select)}` : ''}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }, [selectedIds, view.id])

  // Deep links: an external hash change opens that view and selection.
  useEffect(() => {
    const handler = () => {
      const parsed = parseHash()
      if (parsed.viewId && projectRef.current.views[parsed.viewId]) {
        setCurrentViewId(parsed.viewId)
        setSelectedIds(new Set(parsed.select))
      }
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [projectRef])

  const theme = THEMES[project.settings.styleTheme] ?? THEMES.compact
  const labels = useMemo(() => renderLabels(copy, project, view), [copy, project, view])
  const model = useMemo(() => buildRenderModel(project, view, theme, labels, { positions: preview.positions ?? undefined, boundary: preview.boundary ?? undefined }), [labels, preview, project, theme, view])
  const findings = useMemo(() => allFindings(project), [project])
  const groups = useMemo(() => Object.values(project.groups), [project.groups])
  const scopeGroups = useMemo(() => groups.filter((group) => group.scopeId === view.scopeId), [groups, view.scopeId])
  const crumbs = useMemo(() => breadcrumb(project, view, copy.breadcrumbRoot), [copy.breadcrumbRoot, project, view])
  const siblingViews = useMemo(() => viewsForScope(project, view.kind, view.scopeId), [project, view.kind, view.scopeId])
  const selectedNodes = useMemo(() => model.nodes.filter((node) => selectedIds.has(node.id)), [model.nodes, selectedIds])

  const say = useCallback((message: string) => setNotice(message), [])

  const openScope = useCallback((kind: ViewKind, scopeId: string | null) => {
    const current = projectRef.current
    const ensured = ensureDefaultView(current, kind, scopeId)
    if (ensured.project !== current) commit(() => withInitialLayout(ensured.project, ensured.view.id))
    setCurrentViewId(ensured.view.id)
    setSelectedIds(new Set())
    setPreview({ positions: null, boundary: null })
    lastCreated.current = null
    return ensured.view.id
  }, [commit, projectRef, withInitialLayout])

  const openView = useCallback((id: string) => {
    if (!projectRef.current.views[id]) return false
    setCurrentViewId(id)
    setSelectedIds(new Set())
    lastCreated.current = null
    return true
  }, [projectRef])

  const enter = useCallback((elementId: string) => {
    const element = projectRef.current.elements[elementId]
    const kind = element ? childViewKind(element) : undefined
    if (kind) openScope(kind, elementId)
  }, [openScope, projectRef])

  const select = useCallback((ids: string[], additive: boolean) => {
    setSelectedIds((current) => {
      if (!additive) return new Set(ids)
      const next = new Set(current)
      ids.forEach((id) => { if (next.has(id)) next.delete(id); else next.add(id) })
      return next
    })
  }, [])

  const patchElement = useCallback((id: string, patch: Partial<Element>) => commit((current) => commands.patchElement(current, id, patch)), [commit])
  const patchRelationship = useCallback((id: string, patch: Partial<Relationship>) => commit((current) => commands.patchRelationship(current, id, patch)), [commit])
  const patchView = useCallback((patch: Partial<DiagramView>) => commit((current) => commands.patchView(current, view.id, patch)), [commit, view.id])

  const deleteElements = useCallback((ids: string[]) => {
    const current = projectRef.current
    const hasChildren = ids.some((id) => Object.values(current.elements).some((element) => element.parentId === id))
    if (hasChildren && !window.confirm(copy.confirmDelete)) return []
    const result = commands.deleteElements(current, ids)
    commit(() => result.project)
    setSelectedIds(new Set())
    say(`${ids.map((id) => current.elements[id]?.name).filter(Boolean).join(', ')} ${copy.deleted}`)
    return result.deletedIds
  }, [commit, copy.confirmDelete, copy.deleted, projectRef, say])

  const deleteRelationship = useCallback((id: string) => {
    if (!projectRef.current.relationships[id]) return false
    commit((current) => commands.deleteRelationship(current, id))
    setSelectedIds(new Set())
    return true
  }, [commit, projectRef])

  const createFromQuick = useCallback((input: QuickCreateInput) => {
    const current = projectRef.current
    const size = nodeSize(view.displayMode)
    const existing = model.nodes.map((node) => node.rect)
    const region = model.boundary && view.kind !== 'c4_context' ? model.boundary : undefined
    const position = nextFreePosition(existing, size, lastCreated.current ?? undefined, region)
    const created = commands.createElement(current, {
      kind: input.kind,
      name: input.name,
      description: input.description,
      technology: '',
      parentId: view.scopeId ?? undefined,
      containerCategory: input.containerCategory,
      applicationKind: input.applicationKind,
      dataStoreKind: input.dataStoreKind,
      sqlDialect: input.sqlDialect,
      groupId: input.groupId,
    })
    let next = commands.setPositions(created.project, view.id, { [created.element.id]: position })
    if (view.elementRefs.length) next = commands.patchView(next, view.id, { elementRefs: [...view.elementRefs, created.element.id] })
    commit(() => next)
    lastCreated.current = { ...position, ...size }
    setSelectedIds(new Set([created.element.id]))
    say(`${input.name} ${copy.elementAdded}`)
  }, [commit, copy.elementAdded, model.boundary, model.nodes, projectRef, say, view])

  const commitPositions = useCallback((positions: Record<string, Position>, boundary?: Rect, droppedId?: string) => {
    commit((current) => {
      let next = commands.setPositions(current, view.id, positions, boundary)
      if (droppedId) {
        const node = model.nodes.find((item) => item.id === droppedId)
        const element = current.elements[droppedId]
        if (node && element && node.placement === 'internal') {
          const moved = positions[droppedId]
          const center = { x: moved.x + node.rect.width / 2, y: moved.y + node.rect.height / 2 }
          const hit = [...model.groups].reverse().find((group) => center.x >= group.rect.x && center.x <= group.rect.x + group.rect.width && center.y >= group.rect.y && center.y <= group.rect.y + group.rect.height)
          const groupId = hit?.id
          if ((element.groupId ?? undefined) !== groupId) next = commands.setElementGroup(next, droppedId, groupId)
        }
      }
      return next
    })
  }, [commit, model.groups, model.nodes, view.id])

  const connect = useCallback((sourceId: string, targetId: string) => {
    const current = projectRef.current
    const existing = Object.values(current.relationships).find((relationship) => relationship.sourceId === sourceId && relationship.targetId === targetId)
    if (existing) { setSelectedIds(new Set([existing.id])); return }
    const created = commands.createRelationship(current, { sourceId, targetId, label: '' })
    commit(() => created.project)
    setSelectedIds(new Set([created.relationship.id]))
  }, [commit, projectRef])

  const applyLayout = useCallback((compute: (boxes: Box[]) => Record<string, Position>) => {
    const boxes: Box[] = selectedNodes.map((node) => ({ id: node.id, ...node.rect }))
    const positions = compute(boxes)
    if (!Object.keys(positions).length) return
    commit((current) => commands.setPositions(current, view.id, positions))
  }, [commit, selectedNodes, view.id])

  const runArrange = useCallback((selectionOnly: boolean, viewId = view.id) => {
    const current = projectRef.current
    const target = current.views[viewId]
    if (!target) return false
    const only = selectionOnly && selectedNodes.length > 1 ? new Set(selectedNodes.map((node) => node.id)) : undefined
    const result = arrangeView(current, target, only)
    commit((state) => commands.setPositions(state, viewId, result.positions, result.boundary))
    return true
  }, [commit, projectRef, selectedNodes, view.id])

  const doExport = useCallback(async (format: ExportFormat) => {
    setShowExport(false)
    try {
      const exportLabels = renderLabels(copy, project, view, `${project.name} · ${new Date().toISOString().slice(0, 10)}`)
      const exportModel = buildRenderModel(project, view, theme, exportLabels)
      await exportView(format, project, exportModel, fileStem(project, viewTitle(copy, project, view)))
      say(`${copy.exported}: ${format.toUpperCase()}`)
    } catch {
      say(copy.exportFailed)
    }
  }, [copy, project, say, theme, view])

  const importProject = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseProject(await file.text())
      replace(parsed)
      setCurrentViewId(null)
      setSelectedIds(new Set())
      say(copy.imported)
    } catch (error) {
      say(`${copy.importFailed}: ${error instanceof Error ? error.message : ''}`)
    } finally {
      event.target.value = ''
    }
  }, [copy.importFailed, copy.imported, replace, say])

  const startProject = useCallback((kind: 'blank' | 'starter') => {
    replace(kind === 'blank' ? emptyProject(copy.newProject) : commerceStarter())
    setCurrentViewId(null)
    setSelectedIds(new Set())
    setShowNew(false)
  }, [copy.newProject, replace])

  const navigateFinding = useCallback((finding: Finding) => {
    if (finding.viewId && projectRef.current.views[finding.viewId]) openView(finding.viewId)
    if (finding.targetKind === 'element' || finding.targetKind === 'relationship') setSelectedIds(new Set([finding.targetId]))
  }, [openView, projectRef])

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).then(() => say(copy.linkCopied)).catch(() => undefined)
  }, [copy.linkCopied, say])

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (typing) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const ids = [...selectedIds]
        const elementIds = ids.filter((id) => projectRef.current.elements[id])
        const relationshipIds = ids.filter((id) => projectRef.current.relationships[id])
        if (elementIds.length) deleteElements(elementIds)
        relationshipIds.forEach((id) => deleteRelationship(id))
      }
      if (event.key === 'Escape') { setSelectedIds(new Set()); setQuickCreate(false) }
      if (event.key === 'n' && !event.metaKey && !event.ctrlKey) { event.preventDefault(); setQuickCreate(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteElements, deleteRelationship, projectRef, redo, selectedIds, undo])

  // WebMCP tool surface: the agent is another editor.
  useEffect(() => registerWebMcpTools({
    getProject: () => projectRef.current,
    getCurrentViewId: () => view.id,
    listViews: () => Object.values(projectRef.current.views).map(({ id, kind, scopeId, name, isDefault }) => ({ id, kind, scopeId, name, isDefault })),
    openView,
    openScope,
    createElement: (input) => {
      const current = projectRef.current
      const parent = input.parentId ? current.elements[input.parentId] : undefined
      if (input.kind === 'container' && parent?.kind !== 'softwareSystem') return { error: 'Containers need a software system parent' }
      if (input.kind === 'component' && parent?.kind !== 'container') return { error: 'Components need an application container parent' }
      const created = commands.createElement(current, { kind: input.kind, name: input.name, description: input.description ?? '', technology: input.technology ?? '', parentId: input.parentId, containerCategory: input.containerCategory, applicationKind: input.applicationKind, dataStoreKind: input.dataStoreKind })
      commit(() => created.project)
      return created.element
    },
    updateElement: (id, patch) => { if (!projectRef.current.elements[id]) return { error: 'Unknown element' }; patchElement(id, patch); return { ...projectRef.current.elements[id], ...patch } },
    deleteElements: (ids) => commands.deleteElements(projectRef.current, ids).deletedIds.length ? deleteElements(ids) : [],
    createRelationship: (input) => { const current = projectRef.current; if (!current.elements[input.sourceId] || !current.elements[input.targetId]) return { error: 'Unknown endpoint' }; const created = commands.createRelationship(current, input); commit(() => created.project); return created.relationship },
    updateRelationship: (id, patch) => { if (!projectRef.current.relationships[id]) return { error: 'Unknown relationship' }; patchRelationship(id, patch); return { ...projectRef.current.relationships[id], ...patch } },
    deleteRelationship,
    arrangeView: (viewId) => runArrange(false, viewId ?? view.id),
    findings: () => allFindings(projectRef.current),
  }, setWebMcpReady), [commit, deleteElements, deleteRelationship, openScope, openView, patchElement, patchRelationship, projectRef, runArrange, view.id])

  const helperButton = (name: IconName, title: string, onClick: () => void, disabled = false) => (
    <button key={title} type="button" className="btn btn-ghost btn-xs join-item text-muted hover:bg-white/5 hover:text-base-content disabled:opacity-30" title={title} aria-label={title} onClick={onClick} disabled={disabled}><Icon name={name} size={14} /></button>
  )
  const multi = selectedNodes.length >= 2
  const exportItems: Array<[ExportFormat, string]> = [['json', copy.exportJson], ['svg', copy.exportSvg], ['png', copy.exportPng], ['pdf', copy.exportPdf], ['drawio', copy.exportDrawio]]

  return (
    <div data-theme="archidiag" className="min-h-screen bg-ink text-base-content">
      <header className="relative z-50 flex h-[60px] items-center justify-between border-b border-line/80 bg-ink/90 px-5 backdrop-blur">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan text-ink"><Icon name="layers" size={17} stroke={2.2} /></div>
            <div><div className="text-[14px] font-bold tracking-wide">{copy.appName}</div><div className="text-[9px] uppercase tracking-[0.2em] text-muted">{copy.studio}</div></div>
          </div>
          <div className="relative flex items-center gap-2 text-sm text-muted">
            <Icon name="folder" size={15} />
            <input className="w-48 rounded-md border border-transparent bg-transparent px-1 text-base-content hover:border-line focus:border-cyan focus:outline-none" value={project.name} onChange={(event) => commit((current) => ({ ...current, name: event.target.value }))} />
            <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px]">{copy.local}</span>
            <button type="button" className="btn btn-ghost btn-xs text-muted" onClick={() => setShowNew((value) => !value)}>{copy.newProject}<Icon name="chevronDown" size={12} /></button>
            {showNew && (
              <div className="absolute left-0 top-9 z-40 w-64 rounded-xl border border-line bg-panel p-2 shadow-glow" onMouseLeave={() => setShowNew(false)}>
                <div className="px-2 py-1 text-[10px] text-muted">{copy.startHint}</div>
                <button type="button" className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5" onClick={() => startProject('starter')}>{copy.startStarter}</button>
                <button type="button" className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5" onClick={() => startProject('blank')}>{copy.startBlank}</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] md:flex ${webMcpReady ? 'border-cyan/30 bg-cyan/5 text-cyan' : 'border-line bg-panel/60 text-muted'}`}><span className={`h-1.5 w-1.5 rounded-full ${webMcpReady ? 'bg-cyan' : 'bg-muted'}`} />WebMCP</div>
          <div className="join border border-line bg-panel/60">
            <button type="button" onClick={() => setLocale('en')} className={`btn btn-ghost btn-xs join-item ${locale === 'en' ? 'bg-cyan/15 text-cyan' : 'text-muted'}`}>EN</button>
            <button type="button" onClick={() => setLocale('ja')} className={`btn btn-ghost btn-xs join-item ${locale === 'ja' ? 'bg-cyan/15 text-cyan' : 'text-muted'}`}>JA</button>
          </div>
          <button type="button" className={`btn btn-ghost btn-sm ${showChecks ? 'text-cyan' : 'text-muted'} hover:bg-white/5`} onClick={() => setShowChecks((value) => !value)}>
            <Icon name="check" size={15} /> {copy.validate}
            {findings.some((finding) => finding.level === 'error') && <span className="ml-1 rounded-full bg-rose-500/20 px-1.5 text-[10px] text-rose-300">{findings.filter((finding) => finding.level === 'error').length}</span>}
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-muted hover:bg-white/5" onClick={() => fileInputRef.current?.click()}><Icon name="upload" size={15} /> {copy.import}</button>
          <div className="relative">
            <button type="button" className="btn btn-primary btn-sm px-4 text-ink" onClick={() => setShowExport((value) => !value)}><Icon name="download" size={15} /> {copy.exportMenu}<Icon name="chevronDown" size={13} /></button>
            {showExport && (
              <div className="absolute right-0 top-10 z-40 w-48 rounded-xl border border-line bg-panel p-1.5 shadow-glow" onMouseLeave={() => setShowExport(false)}>
                {exportItems.map(([format, label]) => <button key={format} type="button" className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5" onClick={() => doExport(format)}>{label}</button>)}
              </div>
            )}
          </div>
          <input ref={fileInputRef} onChange={importProject} type="file" accept="application/json,.json" className="hidden" />
        </div>
      </header>

      <main className="grid h-[calc(100vh-60px)] grid-cols-[232px_minmax(480px,1fr)_280px]">
        <Explorer project={project} view={view} copy={copy} search={search} onSearch={setSearch} onOpenScope={openScope} onSelectElement={(id) => { const element = project.elements[id]; if (!element) return; const scopeKind: ViewKind = element.parentId ? (project.elements[element.parentId]?.kind === 'softwareSystem' ? 'c4_container' : 'c4_component') : 'c4_context'; if (view.scopeId !== (element.parentId ?? null) || view.kind !== scopeKind) openScope(scopeKind, element.parentId ?? null); setSelectedIds(new Set([id])) }} onQuickCreate={() => setQuickCreate(true)} notice={notice} />

        <section className="flex min-w-0 flex-col bg-ink/35">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line/80 px-5 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                {crumbs.map((crumb, index) => (
                  <span key={`${crumb.kind}-${crumb.scopeId}`} className="flex items-center gap-1.5">
                    {index > 0 && <Icon name="chevron" size={11} />}
                    <button type="button" className={`rounded px-1 hover:text-cyan ${index === crumbs.length - 1 ? 'text-base-content' : ''}`} onClick={() => openScope(crumb.kind, crumb.scopeId)}>{crumb.label}</button>
                  </span>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-1">
                {siblingViews.map((sibling) => (
                  <button key={sibling.id} type="button" onClick={() => openView(sibling.id)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${sibling.id === view.id ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`}>
                    {sibling.isDefault && <Icon name="star" size={10} />}{sibling.name || copy.viewKinds[sibling.kind]}
                  </button>
                ))}
                <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-cyan" title={copy.newView} onClick={() => { const created = commands.createView(projectRef.current, view.kind, view.scopeId, `View ${siblingViews.length + 1}`); commit(() => withInitialLayout(created.project, created.view.id)); openView(created.view.id) }}><Icon name="plus" size={13} /></button>
                <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-cyan" title={copy.duplicateView} onClick={() => { const created = commands.createView(projectRef.current, view.kind, view.scopeId, `${view.name || copy.viewKinds[view.kind]} copy`, view); commit(() => created.project); openView(created.view.id) }}><Icon name="copy" size={13} /></button>
                {!view.isDefault && <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-cyan" title={copy.setDefault} onClick={() => commit((current) => commands.setDefaultView(current, view.id))}><Icon name="star" size={13} /></button>}
                {siblingViews.length > 1 && <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-rose-500/10 hover:text-rose-400" title={copy.deleteView} onClick={() => { const next = commands.deleteView(projectRef.current, view.id); commit(() => next); setCurrentViewId(null) }}><Icon name="trash" size={13} /></button>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="join border border-line bg-panel/60">
                {helperButton('undo', copy.undo, undo, !canUndo)}
                {helperButton('redo', copy.redo, redo, !canRedo)}
              </div>
              <div className="join border border-line bg-panel/60">
                {helperButton('plus', `${copy.quickCreate} (N)`, () => setQuickCreate(true))}
                {helperButton('wand', multi ? copy.arrangeSelection : copy.arrangeAll, () => runArrange(multi))}
              </div>
              {multi && <div className="join border border-line bg-panel/60">
                {helperButton('alignLeft', copy.alignLeft, () => applyLayout((boxes) => alignBoxes(boxes, 'left' as AlignMode)), !multi)}
                {helperButton('alignCenterX', copy.alignCenterX, () => applyLayout((boxes) => alignBoxes(boxes, 'centerX')), !multi)}
                {helperButton('alignRight', copy.alignRight, () => applyLayout((boxes) => alignBoxes(boxes, 'right')), !multi)}
                {helperButton('alignTop', copy.alignTop, () => applyLayout((boxes) => alignBoxes(boxes, 'top')), !multi)}
                {helperButton('alignCenterY', copy.alignCenterY, () => applyLayout((boxes) => alignBoxes(boxes, 'centerY')), !multi)}
                {helperButton('alignBottom', copy.alignBottom, () => applyLayout((boxes) => alignBoxes(boxes, 'bottom')), !multi)}
                {helperButton('distributeX', copy.distributeX, () => applyLayout((boxes) => distributeBoxes(boxes, 'x')), selectedNodes.length < 3)}
                {helperButton('distributeY', copy.distributeY, () => applyLayout((boxes) => distributeBoxes(boxes, 'y')), selectedNodes.length < 3)}
                {helperButton('row', copy.row, () => applyLayout((boxes) => arrangeBoxes(boxes, 'row' as ArrangeMode)), !multi)}
                {helperButton('column', copy.column, () => applyLayout((boxes) => arrangeBoxes(boxes, 'column')), !multi)}
                {helperButton('grid', copy.grid, () => applyLayout((boxes) => arrangeBoxes(boxes, 'grid', 3)), !multi)}
                {helperButton('shrink', copy.tighten, () => applyLayout((boxes) => spaceBoxes(boxes, -0.15)), !multi)}
                {helperButton('expand', copy.loosen, () => applyLayout((boxes) => spaceBoxes(boxes, 0.15)), !multi)}
              </div>}
              <div className="join border border-line bg-panel/60" title={copy.displayMode}>
                {(['descriptive', 'compact', 'technology_only'] as const).map((mode) => (
                  <button key={mode} type="button" className={`btn btn-ghost btn-xs join-item ${view.displayMode === mode ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`} onClick={() => patchView({ displayMode: mode })}>
                    {mode === 'descriptive' ? copy.descriptive : mode === 'compact' ? copy.compact : copy.technologyOnly}
                  </button>
                ))}
              </div>
              <div className="join border border-line bg-panel/60" title={copy.theme}>
                {Object.values(THEMES).map((item) => (
                  <button key={item.id} type="button" className={`btn btn-ghost btn-xs join-item ${project.settings.styleTheme === item.id ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`} onClick={() => commit((current) => ({ ...current, settings: { ...current.settings, styleTheme: item.id } }))}>
                    {item.id === 'compact' ? copy.themeCompact : item.id === 'classic_c4' ? copy.themeClassic : copy.themeMono}
                  </button>
                ))}
              </div>
              <div className="join border border-line bg-panel/60">
                {helperButton('zoomOut', copy.zoomOut, () => setZoom((value) => Math.max(0.4, Math.round((value - 0.1) * 10) / 10)))}
                <span className="join-item grid place-items-center px-2 text-[11px] text-muted">{Math.round(zoom * 100)}%</span>
                {helperButton('zoomIn', copy.zoomIn, () => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10)))}
              </div>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col p-4">
            {quickCreate && <QuickCreate view={view} groups={scopeGroups} copy={copy} onCreate={createFromQuick} onClose={() => setQuickCreate(false)} />}
            <Canvas
              model={model}
              zoom={zoom}
              selectedIds={selectedIds}
              copy={copy}
              onSelect={select}
              onEnter={enter}
              onPreview={(positions, boundary) => setPreview({ positions, boundary })}
              onCommitPositions={commitPositions}
              onCommitBoundary={(boundary) => commit((current) => commands.setBoundary(current, view.id, boundary))}
              onConnect={connect}
              onBackgroundDoubleClick={() => setQuickCreate(true)}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <div className="flex items-center gap-4"><span>{copy.doubleClickToEnter}</span><span>{copy.dragToMove}</span></div>
              <span>{copy.viewKinds[view.kind]} · {model.nodes.length} / {model.edges.length}</span>
            </div>
          </div>
          {showChecks && <ValidationPanel findings={findings} profileId={project.settings.checkProfile} copy={copy} onProfileChange={(id) => commit((current) => ({ ...current, settings: { ...current.settings, checkProfile: id } }))} onNavigate={navigateFinding} onClose={() => setShowChecks(false)} />}
        </section>

        <Inspector
          project={project}
          view={view}
          selectedIds={selectedIds}
          copy={copy}
          groups={groups}
          onPatchElement={patchElement}
          onPatchRelationship={patchRelationship}
          onDeleteElements={deleteElements}
          onDeleteRelationship={deleteRelationship}
          onOpenScope={openScope}
          onPatchView={patchView}
          onCreateGroup={(name) => commit((current) => commands.createGroup(current, { scopeId: view.scopeId, name, description: '' }).project)}
          onPatchGroup={(id, patch) => commit((current) => commands.patchGroup(current, id, patch))}
          onDeleteGroup={(id) => commit((current) => commands.deleteGroup(current, id))}
          onCopyLink={copyLink}
          onSelect={(id) => setSelectedIds(new Set([id]))}
        />
      </main>
    </div>
  )
}

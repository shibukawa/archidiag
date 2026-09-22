import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { arrangeView } from '../core/arrange'
import * as commands from '../core/commands'
import { parseProject, serializeProject } from '../core/io'
import { allRelationships, connectionVerdict, dfdOf, importableLinks, nodeElement, nodeName, nextProcessNumber, roleForElement, type PlacementOption } from '../core/dfd'
import { alignBoxes, arrangeBoxes, dfdNodeSize, distributeBoxes, nextFreePosition, nodeSize, nodeSizeFor, spaceBoxes, type AlignMode, type ArrangeMode, type Box } from '../core/layout'
import { childViewKind, defaultErdRelationship, displayModesFor, emptyProject, isDfdView, isErdStore, isErdView, itemKindFor, pairedC4Kind, pairedDfdKind, scopeViewKindFor, storeOf, type DfdNode, type DiagramView, type Element, type IntermediateKind, type Position, type Project, type Rect, type Relationship, type ViewKind } from '../core/model'
import { buildRenderModel } from '../core/render'
import { commerceStarter } from '../core/starter'
import { THEMES } from '../core/theme'
import { allFindings, type Finding } from '../core/validate'
import { breadcrumb, defaultView, ensureDefaultView, viewsForScope } from '../core/views'
import { Canvas } from './Canvas'
import { Explorer } from './Explorer'
import { exportView, fileStem, type ExportFormat } from './exporters'
import type { DfdActions } from './DfdInspector'
import { COPY, dfdLabel, renderLabels, viewTitle, type Locale } from './i18n'
import { Icon, type IconName } from './icons'
import { Inspector } from './Inspector'
import { QuickCreate, type QuickCreateInput } from './QuickCreate'
import { useProjectHistory } from './useHistory'
import { ValidationPanel } from './ValidationPanel'
import { VolumePanel } from './VolumePanel'
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
  const { project, projectRef, commit, endBatch, replace, undo, redo, canUndo, canRedo } = history
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem(LOCALE_KEY) === 'ja' ? 'ja' : 'en'))
  const copy = COPY[locale]
  const initialHash = useMemo(parseHash, [])
  const [currentViewId, setCurrentViewId] = useState<string | null>(initialHash.viewId ?? null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialHash.select))
  const [zoom, setZoom] = useState(1)
  const [preview, setPreview] = useState<{ positions: Record<string, Position> | null; boundary: Rect | null }>({ positions: null, boundary: null })
  const [quickCreate, setQuickCreate] = useState(false)
  const [showChecks, setShowChecks] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingIntermediate, setPendingIntermediate] = useState<{ sourceId: string; targetId: string } | null>(null)
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
  const isDfd = isDfdView(view.kind)
  const crumbs = useMemo(() => breadcrumb(project, view, copy.breadcrumbRoot, dfdLabel(copy, view)), [copy, project, view])
  // The navigator shows the scope's C4 (or ERD) views and its DFDs side by side (rule: dfd-c4-pairing side_by_side).
  const siblingViews = useMemo(() => viewsForScope(project, isDfd ? pairedC4Kind(view.kind) : view.kind, view.scopeId), [isDfd, project, view.kind, view.scopeId])
  const dfdKind = pairedDfdKind(view.kind)
  const dfdSiblings = useMemo(() => (dfdKind ? viewsForScope(project, dfdKind, view.scopeId) : []), [dfdKind, project, view.scopeId])
  const selectedNodes = useMemo(() => model.nodes.filter((node) => selectedIds.has(node.id)), [model.nodes, selectedIds])

  const say = useCallback((message: string) => setNotice(message), [])
  const setHorizon = useCallback((months: number) => commit((current) => ({ ...current, settings: { ...current.settings, volumeHorizonMonths: months } }), 'settings:horizon'), [commit])
  // The data store whose volume the bubble chart shows: the scope of a Component ERD, or the owner store of a Code ERD.
  const volumeStoreId = isErdView(view.kind) && view.scopeId ? (view.kind === 'erd_component' ? view.scopeId : storeOf(project, project.elements[view.scopeId])?.id) : undefined

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
    setPendingIntermediate(null)
    lastCreated.current = null
    return true
  }, [projectRef])

  /** Opens the selected element's scope view in C4 or ERD and selects it there. */
  const openElement = useCallback((id: string) => {
    const current = projectRef.current
    const element = current.elements[id]
    if (!element) return
    const scopeKind: ViewKind = scopeViewKindFor(current, element)
    const currentView = current.views[currentViewId ?? '']
    if (!currentView || currentView.scopeId !== (element.parentId ?? null) || currentView.kind !== scopeKind) openScope(scopeKind, element.parentId ?? null)
    setSelectedIds(new Set([id]))
  }, [currentViewId, openScope, projectRef])

  /** Double-click on a group toggles collapse; on a reference opens its target DFD; on a bound node enters the element's own C4 or ERD scope. */
  const zoomProcess = useCallback((nodeId: string) => {
    const current = projectRef.current
    const currentView = current.views[view.id]
    if (currentView?.dfd?.groups[nodeId]) {
      const collapsed = (currentView.layout.collapsedGroupIds ?? []).includes(nodeId)
      commit((state) => commands.setGroupCollapsed(state, view.id, nodeId, !collapsed))
      setSelectedIds(new Set([nodeId]))
      return
    }
    const node = currentView?.dfd?.nodes[nodeId]
    if (!node) return
    if (node.role === 'diagram_ref') { if (node.targetViewId) openView(node.targetViewId); return }
    if (!node.elementId) { say(copy.needsPlacement); return }
    const element = current.elements[node.elementId]
    const kind = element ? childViewKind(element) : undefined
    if (kind) openScope(kind, element!.id)
  }, [commit, copy.needsPlacement, openScope, openView, projectRef, say, view.id])

  const enter = useCallback((id: string) => {
    if (isDfd) { zoomProcess(id); return }
    const element = projectRef.current.elements[id]
    const kind = element ? childViewKind(element) : undefined
    if (kind) openScope(kind, id)
  }, [isDfd, openScope, projectRef, zoomProcess])

  const select = useCallback((ids: string[], additive: boolean) => {
    setSelectedIds((current) => {
      if (!additive) return new Set(ids)
      const next = new Set(current)
      ids.forEach((id) => { if (next.has(id)) next.delete(id); else next.add(id) })
      return next
    })
  }, [])

  // The optional batch key folds a text field's keystrokes into one undo step until the field blurs (rule: undo-scope).
  const patchElement = useCallback((id: string, patch: Partial<Element>, batchKey?: string) => commit((current) => commands.pruneEmptyPlaceholders(commands.patchElement(current, id, patch)), batchKey), [commit])
  const materialize = useCallback((relationship: Relationship) => { const result = commands.materializeRelationship(projectRef.current, relationship); commit(() => result.project); setSelectedIds(new Set([result.relationship.id])) }, [commit, projectRef])
  const patchRelationship = useCallback((id: string, patch: Partial<Relationship>, batchKey?: string) => commit((current) => commands.patchRelationship(current, id, patch), batchKey), [commit])
  const patchView = useCallback((patch: Partial<DiagramView>, batchKey?: string) => commit((current) => commands.patchView(current, view.id, patch), batchKey), [commit, view.id])

  const deleteElements = useCallback((ids: string[]) => {
    const current = projectRef.current
    const hasChildren = ids.some((id) => Object.values(current.elements).some((element) => element.parentId === id))
    if (hasChildren && !window.confirm(copy.confirmDelete)) return []
    const result = commands.deleteElements(current, ids)
    commit(() => commands.pruneEmptyPlaceholders(result.project))
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

  // ---------- DFD ----------

  const dfdActions: DfdActions = useMemo(() => ({
    patchNode: (nodeId, patch, batchKey) => commit((current) => {
      const payload = dfdOf(current.views[view.id])
      const node = payload.nodes[nodeId]
      // A free node turned into a process takes the next number; numbers are never reused (data:dfd-model process_number).
      if (node && patch.role === 'process' && !node.processNumber) {
        const next = nextProcessNumber(payload)
        return commands.patchNode(commands.upsertView(current, { ...current.views[view.id], dfd: next.payload }), view.id, nodeId, { ...patch, processNumber: next.number })
      }
      return commands.patchNode(current, view.id, nodeId, patch)
    }, batchKey),
    deleteNodes: (nodeIds) => { commit((current) => commands.deleteNodes(current, view.id, nodeIds)); setSelectedIds(new Set()) },
    placeNode: (nodeId, option: PlacementOption) => {
      const result = commands.placeNode(projectRef.current, view.id, nodeId, option)
      commit(() => result.project)
      if (result.element) say(`${result.element.name} ${copy.elementAdded}`)
    },
    bindNode: (nodeId, elementId) => commit((current) => commands.bindNode(current, view.id, nodeId, elementId)),
    unbindNode: (nodeId) => commit((current) => { const node = current.views[view.id]?.dfd?.nodes[nodeId]; return node ? commands.patchNode(current, view.id, nodeId, { elementId: undefined, name: nodeName(current, node), description: node.description || (nodeElement(current, node)?.description ?? ''), technology: node.technology || (nodeElement(current, node)?.technology ?? '') }) : current }),
    zoomProcess,
    openElement,
    patchFlow: (flowId, patch, batchKey) => commit((current) => commands.patchFlow(current, view.id, flowId, patch), batchKey),
    deleteFlow: (flowId) => { commit((current) => commands.deleteFlow(current, view.id, flowId)); setSelectedIds(new Set()) },
    createBoundary: (flowIds) => {
      const created = commands.createBoundary(projectRef.current, view.id, `${copy.dfdBoundary} ${Object.keys(dfdOf(projectRef.current.views[view.id]).boundaries).length + 1}`, flowIds)
      commit(() => created.project)
      if (created.boundary) setSelectedIds(new Set([created.boundary.id]))
    },
    patchBoundary: (boundaryId, patch, batchKey) => commit((current) => commands.patchBoundary(current, view.id, boundaryId, patch), batchKey),
    deleteBoundary: (boundaryId) => { commit((current) => commands.deleteBoundary(current, view.id, boundaryId)); setSelectedIds(new Set()) },
    importLink: (link) => {
      const imported = commands.importLink(projectRef.current, view.id, link)
      commit(() => imported.project)
      if (imported.node) { setSelectedIds(new Set([imported.node.id])); say(`${link.relationship.label || '?'} ${copy.importedLink}`) }
    },
    importAllLinks: () => {
      let next = projectRef.current
      let count = 0
      for (let guard = 0; guard < 100; guard += 1) {
        const link = importableLinks(next, next.views[view.id])[0]
        if (!link) break
        const imported = commands.importLink(next, view.id, link)
        if (!imported.node) break
        next = imported.project
        count += 1
      }
      commit(() => next)
      say(`${count} ${copy.importedLink}`)
    },
    groupMembers: (memberIds) => { const created = commands.groupMembers(projectRef.current, view.id, memberIds); commit(() => created.project); if (created.group) setSelectedIds(new Set([created.group.id])) },
    patchGroup: (groupId, patch, batchKey) => commit((current) => commands.patchProcessGroup(current, view.id, groupId, patch), batchKey),
    ungroup: (groupId) => { commit((current) => commands.ungroupMembers(current, view.id, groupId)); setSelectedIds(new Set()) },
    removeFromGroup: (memberId) => commit((current) => commands.removeFromGroup(current, view.id, memberId)),
    setGroupCollapsed: (groupId, collapsed) => commit((current) => commands.setGroupCollapsed(current, view.id, groupId, collapsed)),
    addDiagramRef: (targetViewId) => {
      const target = projectRef.current.views[targetViewId]
      const size = dfdNodeSize('diagram_ref', view.displayMode)
      const position = nextFreePosition(model.nodes.map((node) => node.rect), size, lastCreated.current ?? undefined)
      const added = commands.addFreeNode(projectRef.current, view.id, { role: 'diagram_ref', name: target ? dfdLabel(copy, target) : '', targetViewId }, position)
      commit(() => added.project)
      lastCreated.current = { ...position, ...size }
      if (added.node) setSelectedIds(new Set([added.node.id]))
    },
    openView,
  }), [commit, copy, model.nodes, openElement, openView, projectRef, say, view.displayMode, view.id, zoomProcess])

  /** An element dragged from the explorer becomes a bound node at the drop point; an element already present is selected instead. */
  const dropElement = useCallback((elementId: string, position: Position) => {
    const current = projectRef.current
    const currentView = current.views[view.id]
    if (!currentView || !isDfdView(currentView.kind)) { say(copy.dropNotDfd); return }
    const existing = Object.values(dfdOf(currentView).nodes).find((node) => node.elementId === elementId)
    if (existing) { setSelectedIds(new Set([existing.id])); say(`${current.elements[elementId]?.name ?? ''} ${copy.alreadyInDfd}`); return }
    const element = current.elements[elementId]
    // People are not nodes: the start marker connects to the screen the person uses (requirement: dfd-flow-direction).
    if (element?.kind === 'person') {
      const connected = commands.connectStartForPerson(current, view.id, elementId)
      commit(() => connected.project)
      if (connected.node) { setSelectedIds(new Set([connected.node.id])); say(`${copy.personNotNode} ${nodeName(connected.project, connected.node)}`) } else say(copy.personNoTarget)
      return
    }
    if (element && !roleForElement(current, currentView, element)) { say(copy.dropNotDfd); return }
    const added = commands.addBoundNode(current, view.id, elementId, position)
    commit(() => added.project)
    if (added.node) { setSelectedIds(new Set([added.node.id])); say(`${current.elements[elementId]?.name ?? ''} ${copy.nodeAdded}`) }
  }, [commit, copy.alreadyInDfd, copy.dropNotDfd, copy.nodeAdded, projectRef, say, view.id])

  /** Creates a DFD paired with the current scope and level; the use case is asked for up front (flow: dfd-authoring define). */
  const newDfd = useCallback(() => {
    if (!dfdKind) return
    const useCase = window.prompt(copy.useCasePlaceholder, '')
    if (useCase === null) return
    const created = commands.createDfd(projectRef.current, dfdKind, view.scopeId, useCase.trim())
    commit(() => created.project)
    openView(created.view.id)
  }, [commit, copy.useCasePlaceholder, dfdKind, openView, projectRef, view.scopeId])

  const midpointBetween = useCallback((sourceId: string, targetId: string, role: DfdNode['role']) => {
    const source = model.nodes.find((node) => node.id === sourceId)?.rect
    const target = model.nodes.find((node) => node.id === targetId)?.rect
    const size = dfdNodeSize(role, view.displayMode)
    if (!source || !target) return undefined
    return { x: Math.round((source.x + source.width + target.x) / 2 - size.width / 2), y: Math.round((source.y + target.y) / 2 + Math.max(source.height, target.height) / 2 - size.height / 2) }
  }, [model.nodes, view.displayMode])

  // Two processes linked become one logical process with intermediate data between them (decision: dfd-logical-process-group).
  const chooseIntermediate = useCallback((kind: IntermediateKind | null) => {
    const pending = pendingIntermediate
    setPendingIntermediate(null)
    if (!pending || !kind) return
    const name = kind === 'api_document' ? copy.apiDocumentName : copy.intermediateName
    const linked = commands.linkProcesses(projectRef.current, view.id, pending.sourceId, pending.targetId, kind, name, midpointBetween(pending.sourceId, pending.targetId, 'intermediate_data'))
    commit(() => linked.project)
    if (linked.node) setSelectedIds(new Set([linked.node.id]))
  }, [commit, copy.apiDocumentName, copy.intermediateName, midpointBetween, pendingIntermediate, projectRef, view.id])

  const createFromQuick = useCallback((input: QuickCreateInput) => {
    const current = projectRef.current
    const existing = model.nodes.map((node) => node.rect)
    if (isDfd && input.dfdRole) {
      const size = dfdNodeSize(input.dfdRole, view.displayMode)
      const position = nextFreePosition(existing, size, lastCreated.current ?? undefined)
      const added = commands.addFreeNode(current, view.id, { role: input.dfdRole, name: input.name, description: input.description, intermediateKind: input.intermediateKind }, position)
      commit(() => added.project)
      lastCreated.current = { ...position, ...size }
      if (added.node) setSelectedIds(new Set([added.node.id]))
      say(`${input.name} ${copy.nodeAdded}`)
      return
    }
    const region = model.boundary && view.kind !== 'c4_context' ? model.boundary : undefined
    // A new table starts with its surrogate primary key; under an owner entity it also gets its dependent link.
    const created = input.kind === 'entity'
      ? commands.createEntity(current, { name: input.name, description: input.description, technology: '', parentId: view.scopeId ?? undefined, groupId: input.groupId })
      : commands.createElement(current, {
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
    const size = input.kind === 'entity' || input.kind === 'topic' || input.kind === 'folder' ? nodeSizeFor(created.element, view.displayMode) : nodeSize(view.displayMode)
    const position = nextFreePosition(existing, size, lastCreated.current ?? undefined, region)
    let next = commands.setPositions(created.project, view.id, { [created.element.id]: position })
    if (view.elementRefs.length) next = commands.patchView(next, view.id, { elementRefs: [...view.elementRefs, created.element.id] })
    commit(() => next)
    lastCreated.current = { ...position, ...size }
    setSelectedIds(new Set([created.element.id]))
    say(`${input.name} ${copy.elementAdded}`)
  }, [commit, copy.elementAdded, copy.nodeAdded, isDfd, model.boundary, model.nodes, projectRef, say, view])

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
    if (isDfd) {
      // rule: dfd-connection-policy. Process to process asks for file or queue; data to data gets a process inserted.
      const payload = dfdOf(current.views[view.id])
      const source = payload.nodes[sourceId]
      const target = payload.nodes[targetId]
      if (!source || !target) return
      const duplicate = Object.values(payload.flows).find((flow) => flow.sourceNodeId === sourceId && flow.targetNodeId === targetId)
      if (duplicate) { setSelectedIds(new Set([duplicate.id])); return }
      const verdict = connectionVerdict(source, target)
      if (verdict.kind === 'forbidden') { say(copy.startOnlyToProcess); return }
      if (verdict.kind === 'process_to_process') { setPendingIntermediate({ sourceId, targetId }); return }
      if (verdict.kind === 'data_to_data') {
        const inserted = commands.insertProcess(current, view.id, sourceId, targetId, copy.insertedProcess, midpointBetween(sourceId, targetId, 'process'))
        commit(() => inserted.project)
        if (inserted.node) setSelectedIds(new Set([inserted.node.id]))
        say(copy.storeToStore)
        return
      }
      const created = commands.createFlow(current, view.id, { sourceNodeId: sourceId, targetNodeId: targetId })
      commit(() => created.project)
      if (created.flow) setSelectedIds(new Set([created.flow.id]))
      return
    }
    const existing = Object.values(current.relationships).find((relationship) => relationship.sourceId === sourceId && relationship.targetId === targetId)
    if (existing) { setSelectedIds(new Set([existing.id])); return }
    // Entity to entity: a reference from the many side to the one side, editable in the inspector.
    const erd = current.elements[sourceId]?.kind === 'entity' && current.elements[targetId]?.kind === 'entity' ? defaultErdRelationship() : undefined
    const created = commands.createRelationship(current, { sourceId, targetId, label: '', ...(erd ? { erd } : {}) })
    commit(() => created.project)
    setSelectedIds(new Set([created.relationship.id]))
  }, [commit, copy.insertedProcess, copy.storeToStore, isDfd, midpointBetween, projectRef, say, view.id])

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
    if (finding.targetKind !== 'view' && finding.targetKind !== 'group' && finding.targetKind !== 'project') setSelectedIds(new Set([finding.targetId]))
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
        if (isDfd) {
          const payload = dfdOf(projectRef.current.views[view.id])
          const nodeIds = ids.filter((id) => payload.nodes[id])
          if (nodeIds.length) dfdActions.deleteNodes(nodeIds)
          ids.filter((id) => payload.flows[id]).forEach((id) => dfdActions.deleteFlow(id))
          ids.filter((id) => payload.boundaries[id]).forEach((id) => dfdActions.deleteBoundary(id))
          ids.filter((id) => payload.groups[id]).forEach((id) => dfdActions.ungroup(id))
          return
        }
        const elementIds = ids.filter((id) => projectRef.current.elements[id])
        const relationshipIds = ids.filter((id) => projectRef.current.relationships[id])
        if (elementIds.length) deleteElements(elementIds)
        relationshipIds.forEach((id) => deleteRelationship(id))
      }
      if (event.key === 'Escape') { setSelectedIds(new Set()); setQuickCreate(false); setPendingIntermediate(null) }
      if (event.key === 'n' && !event.metaKey && !event.ctrlKey) { event.preventDefault(); setQuickCreate(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteElements, deleteRelationship, dfdActions, isDfd, projectRef, redo, selectedIds, undo, view.id])

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
      if (input.kind === 'entity' && !isErdStore(parent) && parent?.kind !== 'entity') return { error: 'Entities need a database or database schema container parent, or an owner entity for a dependent table' }
      if ((input.kind === 'topic' || input.kind === 'folder') && itemKindFor(parent) !== input.kind) return { error: input.kind === 'topic' ? 'Topics need a pub/sub or queue container parent' : 'Folders need a bucket or file share container parent' }
      const created = input.kind === 'entity'
        ? commands.createEntity(current, { name: input.name, description: input.description ?? '', technology: input.technology ?? '', parentId: input.parentId, classification: input.classification, storageKind: input.storageKind })
        : commands.createElement(current, { kind: input.kind, name: input.name, description: input.description ?? '', technology: input.technology ?? '', parentId: input.parentId, containerCategory: input.containerCategory, applicationKind: input.applicationKind, dataStoreKind: input.dataStoreKind, passthrough: input.passthrough })
      commit(() => created.project)
      return created.element
    },
    updateElement: (id, patch) => { if (!projectRef.current.elements[id]) return { error: 'Unknown element' }; patchElement(id, patch); return { ...projectRef.current.elements[id], ...patch } },
    deleteElements: (ids) => commands.deleteElements(projectRef.current, ids).deletedIds.length ? deleteElements(ids) : [],
    createRelationship: (input) => { const current = projectRef.current; if (!current.elements[input.sourceId] || !current.elements[input.targetId]) return { error: 'Unknown endpoint' }; const erd = current.elements[input.sourceId].kind === 'entity' && current.elements[input.targetId].kind === 'entity' ? { ...defaultErdRelationship(), ...input.erd } : undefined; const { erd: _requested, ...rest } = input; const created = commands.createRelationship(current, { ...rest, ...(erd ? { erd } : {}) }); commit(() => created.project); return created.relationship },
    addAttribute: (entityId, name, patch) => { const current = projectRef.current; if (current.elements[entityId]?.kind !== 'entity') return { error: 'Unknown entity' }; const result = commands.addAttribute(current, entityId, name, patch); commit(() => result.project); return result.attribute },
    updateAttribute: (entityId, attributeId, patch) => { const current = projectRef.current; const attribute = current.elements[entityId]?.attributes?.find((item) => item.id === attributeId); if (!attribute) return { error: 'Unknown attribute' }; commit((state) => commands.patchAttribute(state, entityId, attributeId, patch)); return { ...attribute, ...patch } },
    deleteAttribute: (entityId, attributeId) => { const current = projectRef.current; if (!current.elements[entityId]?.attributes?.some((item) => item.id === attributeId)) return false; commit((state) => commands.deleteAttribute(state, entityId, attributeId)); return true },
    updateRelationship: (id, patch) => { if (!projectRef.current.relationships[id]) return { error: 'Unknown relationship' }; patchRelationship(id, patch); return { ...projectRef.current.relationships[id], ...patch } },
    deleteRelationship,
    arrangeView: (viewId) => runArrange(false, viewId ?? view.id),
    findings: () => allFindings(projectRef.current),
    createDfd: (input) => { const current = projectRef.current; if (!input.scopeId || current.elements[input.scopeId]?.kind !== 'softwareSystem') return { error: 'scopeId must be a software system: DFDs live at container level' }; const created = commands.createDfd(current, 'dfd_container', input.scopeId, input.useCase); commit(() => created.project); return created.view },
    addDfdNode: (input) => { const current = projectRef.current; if (!isDfdView(current.views[input.viewId]?.kind ?? 'c4_context')) return { error: 'Unknown DFD' }; const added = input.elementId ? commands.addBoundNode(current, input.viewId, input.elementId) : input.role && input.name ? commands.addFreeNode(current, input.viewId, { role: input.role, name: input.name, description: input.description, intermediateKind: input.intermediateKind }) : { project: current, node: undefined }; if (!added.node) return { error: 'Provide elementId, or role and name' }; commit(() => added.project); return added.node },
    createDfdFlow: (input) => { const current = projectRef.current; const payload = dfdOf(current.views[input.viewId] ?? { kind: 'c4_context' } as DiagramView); const source = payload.nodes[input.sourceNodeId]; const target = payload.nodes[input.targetNodeId]; if (!source || !target) return { error: 'Unknown node' }; if (connectionVerdict(source, target).kind !== 'allowed') return { error: 'Flows join a process with data or an external entity; insert intermediate data or a process between two of a kind' }; const created = commands.createFlow(current, input.viewId, input); if (!created.flow) return { error: 'Could not create flow' }; commit(() => created.project); return created.flow },
    createBoundary: (input) => { const created = commands.createBoundary(projectRef.current, input.viewId, input.name, input.flowIds, input.consistency); if (!created.boundary) return { error: 'Unknown DFD' }; commit(() => created.project); return created.boundary },
    linkProcesses: (input) => { const current = projectRef.current; const payload = dfdOf(current.views[input.viewId] ?? { kind: 'c4_context' } as DiagramView); if (payload.nodes[input.sourceNodeId]?.role !== 'process' || payload.nodes[input.targetNodeId]?.role !== 'process') return { error: 'Both endpoints must be process nodes of the DFD' }; const linked = commands.linkProcesses(current, input.viewId, input.sourceNodeId, input.targetNodeId, input.kind ?? 'api_document', input.name ?? (input.kind === 'api_document' || !input.kind ? copy.apiDocumentName : copy.intermediateName)); if (!linked.node) return { error: 'Could not link' }; commit(() => linked.project); return { node: linked.node, group: linked.group } },
    placeDfdNode: (input) => { const current = projectRef.current; const result = commands.placeNode(current, input.viewId, input.nodeId, { id: 'mcp', kind: input.kind, parentId: input.parentId, patch: {} }); if (!result.element) return { error: 'Node is missing or already bound' }; commit(() => result.project); return result.element },
    importLinks: (input) => { let next = projectRef.current; let imported = 0; for (let guard = 0; guard < 100; guard += 1) { const link = importableLinks(next, next.views[input.viewId])[0]; if (!link) break; const result = commands.importLink(next, input.viewId, link); if (!result.node) break; next = result.project; imported += 1 } commit(() => next); return { imported } },
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
            <input className="w-48 rounded-md border border-transparent bg-transparent px-1 text-base-content hover:border-line focus:border-cyan focus:outline-none" value={project.name} onChange={(event) => commit((current) => ({ ...current, name: event.target.value }), 'project:name')} onBlur={endBatch} />
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
        <Explorer project={project} view={view} copy={copy} search={search} onSearch={setSearch} onOpenScope={openScope} onSelectElement={(id) => { const element = project.elements[id]; if (!element) return; const scopeKind: ViewKind = scopeViewKindFor(project, element); if (view.scopeId !== (element.parentId ?? null) || view.kind !== scopeKind) openScope(scopeKind, element.parentId ?? null); setSelectedIds(new Set([id])) }} onQuickCreate={() => setQuickCreate(true)} onOpenView={openView} notice={notice} />

        <section className="flex min-w-0 flex-col bg-ink/35">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line/80 px-5 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                {crumbs.map((crumb, index) => (
                  <span key={`${crumb.kind}-${crumb.scopeId}`} className="flex items-center gap-1.5">
                    {index > 0 && <Icon name="chevron" size={11} />}
                    <button type="button" className={`rounded px-1 hover:text-cyan ${index === crumbs.length - 1 ? 'text-base-content' : ''}`} onClick={() => (crumb.viewId ? openView(crumb.viewId) : openScope(crumb.kind, crumb.scopeId))}>{crumb.label}</button>
                  </span>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-1">
                {siblingViews.map((sibling) => (
                  <button key={sibling.id} type="button" onClick={() => openView(sibling.id)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${sibling.id === view.id ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`}>
                    {sibling.isDefault && <Icon name="star" size={10} />}{sibling.name || copy.viewKinds[sibling.kind]}
                  </button>
                ))}
                {!isDfd && <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-cyan" title={copy.newView} onClick={() => { const created = commands.createView(projectRef.current, view.kind, view.scopeId, `View ${siblingViews.length + 1}`); commit(() => withInitialLayout(created.project, created.view.id)); openView(created.view.id) }}><Icon name="plus" size={13} /></button>}
                {(dfdKind || dfdSiblings.length > 0) && (
                  <span className="ml-2 flex items-center gap-1 border-l border-line/80 pl-2">
                    {dfdSiblings.map((sibling) => (
                      <button key={sibling.id} type="button" onClick={() => openView(sibling.id)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${sibling.id === view.id ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`} title={copy.viewKinds[sibling.kind]}>
                        <Icon name="flow" size={11} />{dfdLabel(copy, sibling)}
                      </button>
                    ))}
                    {dfdKind && <button type="button" className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted hover:bg-white/5 hover:text-cyan" title={copy.newDfd} onClick={newDfd}><Icon name="plus" size={12} /><Icon name="flow" size={12} /></button>}
                  </span>
                )}
                <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-cyan" title={copy.duplicateView} onClick={() => { const created = commands.createView(projectRef.current, view.kind, view.scopeId, `${view.name || copy.viewKinds[view.kind]} copy`, view); commit(() => created.project); openView(created.view.id) }}><Icon name="copy" size={13} /></button>
                {!view.isDefault && <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-cyan" title={copy.setDefault} onClick={() => commit((current) => commands.setDefaultView(current, view.id))}><Icon name="star" size={13} /></button>}
                {(isDfd || siblingViews.length > 1) && <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-rose-500/10 hover:text-rose-400" title={copy.deleteView} onClick={() => { if (!window.confirm(copy.deleteView + '?')) return; const next = commands.deleteView(projectRef.current, view.id); commit(() => next); if (isDfd) openScope(pairedC4Kind(view.kind), view.scopeId); else setCurrentViewId(null) }}><Icon name="trash" size={13} /></button>}
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
                {volumeStoreId && helperButton('bubbles', copy.bubbleChart, () => setShowVolume((value) => !value))}
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
                {displayModesFor(view.kind).map((mode) => (
                  <button key={mode} type="button" className={`btn btn-ghost btn-xs join-item ${view.displayMode === mode ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`} onClick={() => patchView({ displayMode: mode })}>
                    {mode === 'descriptive' ? copy.descriptive : mode === 'compact' ? copy.compact : mode === 'fields' ? copy.fieldsMode : copy.technologyOnly}
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
            {quickCreate && <QuickCreate view={view} scope={view.scopeId ? project.elements[view.scopeId] : undefined} groups={scopeGroups} copy={copy} onCreate={createFromQuick} onClose={() => setQuickCreate(false)} />}
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
              onDropElement={isDfd ? dropElement : undefined}
              pendingIntermediate={pendingIntermediate}
              onChooseIntermediate={chooseIntermediate}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <div className="flex items-center gap-4"><span>{copy.doubleClickToEnter}</span><span>{copy.dragToMove}</span>{isDfd && <span>{copy.dropHint}</span>}</div>
              <span>{copy.viewKinds[view.kind]} · {model.nodes.length} / {model.edges.length}</span>
            </div>
          </div>
          {showVolume && volumeStoreId && <VolumePanel project={project} storeId={volumeStoreId} copy={copy} selectedIds={selectedIds} onSelect={(id) => setSelectedIds(new Set([id]))} onSetHorizon={setHorizon} onClose={() => setShowVolume(false)} />}
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
          onPatchGroup={(id, patch, batchKey) => commit((current) => commands.patchGroup(current, id, patch), batchKey)}
          onEndBatch={endBatch}
          onSetHorizon={setHorizon}
          onDeleteGroup={(id) => commit((current) => commands.deleteGroup(current, id))}
          onCopyLink={copyLink}
          onSelect={(id) => setSelectedIds(new Set([id]))}
          onOpenView={openView}
          onMaterialize={materialize}
          dfd={isDfd ? dfdActions : undefined}
        />
      </main>
    </div>
  )
}

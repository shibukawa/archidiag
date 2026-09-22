import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { CANVAS_MARGIN_NODE, expandBoundaryToContain, keepOutside, overlaps } from '../core/layout'
import type { IntermediateKind, Position, Rect } from '../core/model'
import { fitOuterBoundary, markerDefs, renderLegend, renderSvg, type RenderModel } from '../core/render'
import type { Copy } from './i18n'
import { Icon } from './icons'
import { usePinchZoom } from './usePinchZoom'

export interface CanvasProps {
  model: RenderModel
  zoom: number
  selectedIds: Set<string>
  copy: Copy
  onSelect: (ids: string[], additive: boolean) => void
  onEnter: (elementId: string) => void
  onPreview: (positions: Record<string, Position> | null, boundary: Rect | null) => void
  onCommitPositions: (positions: Record<string, Position>, boundary?: Rect, droppedId?: string) => void
  onCommitBoundary: (boundary: Rect) => void
  onConnect: (sourceId: string, targetId: string) => void
  onBackgroundDoubleClick: () => void
  onZoom: (zoom: number) => void
  /** An element dragged from the explorer was dropped at this canvas position (DFD views add a bound node). */
  onDropElement?: (elementId: string, position: Position) => void
  /** A process-to-process link awaits the choice of file or queue (rule: dfd-connection-policy). */
  pendingIntermediate?: { sourceId: string; targetId: string } | null
  onChooseIntermediate?: (kind: IntermediateKind | null) => void
}

/** MIME type of an element id dragged out of the explorer. */
export const ELEMENT_DRAG_TYPE = 'application/x-c4sketch-element'

interface DragState {
  pointerId: number
  ids: string[]
  startX: number
  startY: number
  origins: Record<string, Position>
  moved: boolean
  primaryId: string
}

interface BoundaryDrag { pointerId: number; startX: number; startY: number; origin: Rect }

function capture(element: Element | null, pointerId: number) {
  try { element?.setPointerCapture(pointerId) } catch { /* synthetic or already-released pointers cannot be captured */ }
}
interface LinkDrag { pointerId: number; sourceId: string; from: Position; to: Position; hoverId?: string }

export function Canvas({ model, zoom, selectedIds, copy, onSelect, onEnter, onPreview, onCommitPositions, onCommitBoundary, onConnect, onBackgroundDoubleClick, onZoom, onDropElement, pendingIntermediate, onChooseIntermediate }: CanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const boundaryRef = useRef<BoundaryDrag | null>(null)
  const [linkDrag, setLinkDrag] = useState<LinkDrag | null>(null)
  const [legendOpen, setLegendOpen] = useState(true)
  usePinchZoom(frameRef, hostRef, zoom, onZoom)

  const svg = useMemo(() => renderSvg(model, { frame: 'none', background: true, selectedIds, interactive: true }), [model, selectedIds])
  const legendSvg = useMemo(() => {
    const width = 230
    const height = 30 + model.legend.length * 20
    const inner = renderLegend(model, { x: 0, y: 0, width, height })
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${markerDefs(model.theme)}</defs>${inner}</svg>`
  }, [model])

  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model])
  const single = selectedIds.size === 1 ? nodeById.get([...selectedIds][0]) : undefined

  const toCanvas = (event: { clientX: number; clientY: number }): Position => {
    const host = hostRef.current!
    const rect = host.getBoundingClientRect()
    return { x: (event.clientX - rect.left + host.scrollLeft) / zoom, y: (event.clientY - rect.top + host.scrollTop) / zoom }
  }

  const nodeIdAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.('[data-node-id]')?.getAttribute('data-node-id') ?? undefined
  const edgeIdAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.('[data-edge-id]')?.getAttribute('data-edge-id') ?? undefined
  const regionIdAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.('[data-region-id]')?.getAttribute('data-region-id') ?? undefined
  const processGroupIdAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.('[data-pgroup-id]')?.getAttribute('data-pgroup-id') ?? undefined

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const nodeId = nodeIdAt(event.target)
    if (nodeId) {
      const additive = event.shiftKey
      let ids: string[]
      if (selectedIds.has(nodeId)) ids = [...selectedIds].filter((id) => nodeById.has(id))
      else {
        ids = additive ? [...[...selectedIds].filter((id) => nodeById.has(id)), nodeId] : [nodeId]
        onSelect(additive ? [...selectedIds, nodeId] : [nodeId], false)
      }
      const origins: Record<string, Position> = {}
      ids.forEach((id) => { const node = nodeById.get(id); if (node) origins[id] = { x: node.rect.x, y: node.rect.y } })
      dragRef.current = { pointerId: event.pointerId, ids, startX: event.clientX, startY: event.clientY, origins, moved: false, primaryId: nodeId }
      capture(event.currentTarget, event.pointerId)
      return
    }
    const edgeId = edgeIdAt(event.target)
    if (edgeId) {
      onSelect([edgeId], event.shiftKey)
      return
    }
    const regionId = regionIdAt(event.target)
    if (regionId) {
      onSelect([regionId], event.shiftKey)
      return
    }
    const processGroupId = processGroupIdAt(event.target)
    if (processGroupId) {
      onSelect([processGroupId], event.shiftKey)
      return
    }
    if (!event.shiftKey) onSelect([], false)
  }

  // Hover highlight (requirement: edge-hover-highlight): classes are toggled on the rendered SVG without re-rendering it.
  const clearHover = () => {
    const host = hostRef.current
    if (!host) return
    host.querySelectorAll('.hl-edge, .hl-node, .hl-far, .hl-dim').forEach((item) => item.classList.remove('hl-edge', 'hl-node', 'hl-far', 'hl-dim'))
  }
  const handlePointerOver = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current || linkDrag) return
    const host = hostRef.current
    if (!host) return
    const target = event.target as HTMLElement | null
    const edge = target?.closest?.('[data-edge-id]') as HTMLElement | null
    const node = edge ? null : (target?.closest?.('[data-node-id]') as HTMLElement | null)
    clearHover()
    if (edge) {
      edge.classList.add('hl-edge')
      const src = edge.getAttribute('data-src')
      const dst = edge.getAttribute('data-dst')
      host.querySelectorAll(`[data-node-id="${CSS.escape(src ?? '')}"], [data-node-id="${CSS.escape(dst ?? '')}"], [data-pgroup-id="${CSS.escape(src ?? '')}"], [data-pgroup-id="${CSS.escape(dst ?? '')}"]`).forEach((item) => item.classList.add('hl-node'))
      return
    }
    if (node) {
      const id = node.getAttribute('data-node-id') ?? ''
      node.classList.add('hl-node')
      host.querySelectorAll('[data-edge-id]').forEach((item) => {
        const src = item.getAttribute('data-src')
        const dst = item.getAttribute('data-dst')
        if (src === id || dst === id) {
          item.classList.add('hl-edge')
          const far = src === id ? dst : src
          host.querySelectorAll(`[data-node-id="${CSS.escape(far ?? '')}"]`).forEach((other) => other.classList.add('hl-far'))
        } else item.classList.add('hl-dim')
      })
    }
  }
  const handlePointerLeave = () => clearHover()

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!onDropElement || !event.dataTransfer.types.includes(ELEMENT_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const elementId = event.dataTransfer.getData(ELEMENT_DRAG_TYPE)
    if (!onDropElement || !elementId) return
    event.preventDefault()
    const point = toCanvas(event)
    onDropElement(elementId, { x: Math.max(8, Math.round(point.x - 90)), y: Math.max(8, Math.round(point.y - 30)) })
  }

  /**
   * Applies a drag delta to the selection. Internal nodes grow the scope boundary; sibling containers stay
   * outside it but inside the software system boundary; external nodes stay outside both.
   */
  const moveSelection = (drag: DragState, dx: number, dy: number, settle = false) => {
    const positions: Record<string, Position> = {}
    let boundary = model.boundary ? { ...model.boundary } : undefined
    drag.ids.forEach((id) => {
      const node = nodeById.get(id)!
      const floor = node.isExternal || !model.boundary ? 8 : CANVAS_MARGIN_NODE
      const next = { x: Math.max(floor, Math.round(drag.origins[id].x + dx)), y: Math.max(floor, Math.round(drag.origins[id].y + dy)) }
      if (boundary && node.placement === 'internal') boundary = expandBoundaryToContain(boundary, { ...next, width: node.rect.width, height: node.rect.height })
      positions[id] = next
    })
    if (boundary) {
      const rectOf = (id: string) => ({ ...(positions[id] ?? nodeById.get(id)!.rect), width: nodeById.get(id)!.rect.width, height: nodeById.get(id)!.rect.height })
      drag.ids.forEach((id) => {
        const node = nodeById.get(id)!
        if (node.placement === 'sibling') positions[id] = keepOutside(rectOf(id), boundary!)
      })
      const siblingRects = model.nodes.filter((node) => node.placement === 'sibling').map((node) => rectOf(node.id))
      const outer = model.outerBoundary ? fitOuterBoundary(boundary, siblingRects) : boundary
      drag.ids.forEach((id) => {
        const node = nodeById.get(id)!
        if (node.placement === 'external') positions[id] = keepOutside(rectOf(id), outer)
      })
      if (settle) {
        // Push other context nodes clear of boundaries that grew.
        model.nodes.forEach((node) => {
          if (node.placement === 'internal' || positions[node.id]) return
          const moved = keepOutside(node.rect, node.placement === 'sibling' ? boundary! : outer)
          if (moved.x !== node.rect.x || moved.y !== node.rect.y) positions[node.id] = moved
        })
      }
    }
    return { positions, boundary }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag && drag.pointerId === event.pointerId) {
      const dx = (event.clientX - drag.startX) / zoom
      const dy = (event.clientY - drag.startY) / zoom
      if (!drag.moved && Math.hypot(dx, dy) < 3) return
      drag.moved = true
      const { positions, boundary } = moveSelection(drag, dx, dy)
      onPreview(positions, boundary ?? null)
      return
    }
    const resize = boundaryRef.current
    if (resize && resize.pointerId === event.pointerId) {
      const width = Math.max(320, resize.origin.width + (event.clientX - resize.startX) / zoom)
      const height = Math.max(200, resize.origin.height + (event.clientY - resize.startY) / zoom)
      onPreview(null, { ...resize.origin, width, height })
      return
    }
    if (linkDrag && linkDrag.pointerId === event.pointerId) {
      const to = toCanvas(event)
      const hoverId = model.nodes.find((node) => node.id !== linkDrag.sourceId && overlaps({ ...to, width: 1, height: 1 }, node.rect))?.id
      setLinkDrag({ ...linkDrag, to, hoverId })
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag && drag.pointerId === event.pointerId) {
      dragRef.current = null
      if (!drag.moved) {
        onPreview(null, null)
        return
      }
      const dx = (event.clientX - drag.startX) / zoom
      const dy = (event.clientY - drag.startY) / zoom
      const { positions, boundary } = moveSelection(drag, dx, dy, true)
      onPreview(null, null)
      onCommitPositions(positions, boundary, drag.ids.length === 1 ? drag.primaryId : undefined)
      return
    }
    const resize = boundaryRef.current
    if (resize && resize.pointerId === event.pointerId) {
      boundaryRef.current = null
      const width = Math.max(320, resize.origin.width + (event.clientX - resize.startX) / zoom)
      const height = Math.max(200, resize.origin.height + (event.clientY - resize.startY) / zoom)
      onPreview(null, null)
      onCommitBoundary({ ...resize.origin, width, height })
      return
    }
    if (linkDrag && linkDrag.pointerId === event.pointerId) {
      if (linkDrag.hoverId) onConnect(linkDrag.sourceId, linkDrag.hoverId)
      setLinkDrag(null)
    }
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Hit-test by position: the SVG markup is re-rendered between the two clicks, so event.target may be stale.
    const point = toCanvas(event)
    const hit = model.nodes.find((node) => overlaps({ ...point, width: 1, height: 1 }, node.rect))
    if (hit) { onEnter(hit.id); return }
    // The header band of an expanded logical process group collapses it; innermost group wins.
    const header = [...model.processGroups].reverse().find((group) => overlaps({ ...point, width: 1, height: 1 }, { ...group.rect, height: 30 }))
    if (header) { onEnter(header.id); return }
    if (!edgeIdAt(event.target)) onBackgroundDoubleClick()
  }

  const startLink = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!single) return
    event.stopPropagation()
    event.preventDefault()
    const from = { x: single.rect.x + single.rect.width, y: single.rect.y + single.rect.height / 2 }
    setLinkDrag({ pointerId: event.pointerId, sourceId: single.id, from, to: toCanvas(event) })
    capture(hostRef.current, event.pointerId)
  }

  const startBoundaryResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!model.boundary) return
    event.stopPropagation()
    event.preventDefault()
    boundaryRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { ...model.boundary } }
    capture(hostRef.current, event.pointerId)
  }

  useEffect(() => {
    if (linkDrag && !single) setLinkDrag(null)
  }, [linkDrag, single])

  // Escape abandons a link drag whose pointerup never arrived, so the handle comes back.
  useEffect(() => {
    if (!linkDrag) return
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') setLinkDrag(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [linkDrag])

  const width = model.size.width
  const height = model.size.height
  return (
    <div ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line shadow-glow">
      <div
        ref={hostRef}
        className="absolute inset-0 overflow-auto"
        style={{ background: model.theme.background }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerOver={handlePointerOver}
        onPointerLeave={handlePointerLeave}
      >
        <style>{`
          .hl-edge .edge-line { stroke: #2563eb !important; stroke-width: 2.6 !important; opacity: 1 !important; }
          .hl-edge text { fill: #1d4ed8 !important; font-weight: 700; }
          .hl-edge rect { stroke: #2563eb; }
          .hl-node > path:first-of-type, .hl-node > rect:first-of-type, .hl-node > circle:first-of-type { stroke: #2563eb !important; stroke-width: 3 !important; filter: drop-shadow(0 0 4px rgba(37,99,235,0.55)); }
          .hl-far > path:first-of-type, .hl-far > rect:first-of-type, .hl-far > circle:first-of-type { stroke: #60a5fa !important; stroke-width: 2.4 !important; }
          .hl-dim { opacity: 0.35; }
        `}</style>
        <div className="relative" style={{ width: width * zoom, height: height * zoom }}>
          <div className="absolute left-0 top-0 select-none" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: svg }} />
            {linkDrag && (
              <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
                <path d={`M ${linkDrag.from.x} ${linkDrag.from.y} L ${linkDrag.to.x} ${linkDrag.to.y}`} stroke="#2563eb" strokeWidth="2" strokeDasharray="6 4" fill="none" />
                {linkDrag.hoverId && (() => { const rect = nodeById.get(linkDrag.hoverId)!.rect; return <rect x={rect.x - 4} y={rect.y - 4} width={rect.width + 8} height={rect.height + 8} rx="12" fill="none" stroke="#2563eb" strokeWidth="2" /> })()}
              </svg>
            )}
            {single && !linkDrag && (
              <button
                type="button"
                title={copy.connectHint}
                onPointerDown={startLink}
                className="absolute grid h-6 w-6 place-items-center rounded-full border border-blue-600 bg-white text-blue-600 shadow"
                style={{ left: single.rect.x + single.rect.width - 10, top: single.rect.y + single.rect.height - 10, cursor: 'crosshair' }}
              >
                <Icon name="link" size={13} stroke={2} />
              </button>
            )}
            {pendingIntermediate && onChooseIntermediate && (() => {
              const source = nodeById.get(pendingIntermediate.sourceId)
              const target = nodeById.get(pendingIntermediate.targetId)
              if (!source || !target) return null
              const x = (source.rect.x + source.rect.width + target.rect.x) / 2
              const y = Math.min(source.rect.y, target.rect.y)
              return (
                <div className="absolute z-20 w-64 rounded-xl border border-blue-500 bg-white p-3 text-xs text-slate-800 shadow-xl" style={{ left: Math.max(8, x - 128), top: Math.max(8, y - 8) }} onPointerDown={(event) => event.stopPropagation()}>
                  <div className="mb-2 leading-4">{copy.chooseIntermediate}</div>
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 rounded-md border border-blue-500 bg-blue-50 px-2 py-1 font-semibold text-blue-700" onClick={() => onChooseIntermediate('api_document')}>{copy.insertApi}</button>
                    <button type="button" className="flex-1 rounded-md border border-slate-300 px-2 py-1 font-semibold hover:border-blue-500 hover:text-blue-700" onClick={() => onChooseIntermediate('file')}>{copy.insertFile}</button>
                    <button type="button" className="flex-1 rounded-md border border-slate-300 px-2 py-1 font-semibold hover:border-blue-500 hover:text-blue-700" onClick={() => onChooseIntermediate('queue')}>{copy.insertQueue}</button>
                    <button type="button" className="rounded-md px-2 py-1 text-slate-500 hover:text-slate-800" onClick={() => onChooseIntermediate(null)} aria-label={copy.cancel}><Icon name="x" size={13} /></button>
                  </div>
                </div>
              )
            })()}
            {model.boundary && (
              <button
                type="button"
                onPointerDown={startBoundaryResize}
                className="absolute h-4 w-4 rounded-sm border border-slate-500 bg-white"
                style={{ left: model.boundary.x + model.boundary.width - 8, top: model.boundary.y + model.boundary.height - 8, cursor: 'nwse-resize' }}
                aria-label="resize boundary"
              />
            )}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[420px] rounded-md border bg-white/95 px-3 py-2 shadow" style={{ borderColor: model.theme.frame.stroke }}>
        <div className="text-[13px] font-bold" style={{ color: model.theme.frame.text }}>{model.labels.title}</div>
        {model.labels.subtitle && <div className="text-[10px]" style={{ color: model.theme.frame.subtext }}>{model.labels.subtitle}</div>}
      </div>
      <div className="absolute bottom-3 right-3 z-10">
        {legendOpen ? (
          <div className="relative">
            <button type="button" className="absolute -left-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-slate-300 bg-white text-slate-500" onClick={() => setLegendOpen(false)} title={copy.legend}><Icon name="shrink" size={11} /></button>
            <div className="rounded-md shadow" dangerouslySetInnerHTML={{ __html: legendSvg }} />
          </div>
        ) : (
          <button type="button" className="rounded-md border bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow" style={{ borderColor: model.theme.frame.stroke, color: model.theme.frame.subtext }} onClick={() => setLegendOpen(true)}>{copy.legend}</button>
        )}
      </div>
    </div>
  )
}

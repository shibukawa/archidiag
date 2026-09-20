import type { DisplayMode, Position, Rect } from './model'

export const NODE_WIDTH = 220
export const NODE_HEIGHTS: Record<DisplayMode, number> = { compact: 76, technology_only: 92, descriptive: 124 }
export const CANVAS_MIN_WIDTH = 1200
export const CANVAS_MIN_HEIGHT = 620
export const DEFAULT_BOUNDARY: Rect = { x: 300, y: 60, width: 640, height: 460 }
export const BOUNDARY_PADDING = 32
/** Nodes inside a boundary never sit closer than this to the canvas edge, so the boundary keeps a margin too. */
export const CANVAS_MARGIN_NODE = 56
export const CANVAS_MARGIN_BOUNDARY = 24
export const GAP_X = 72
export const GAP_Y = 40

export interface Box extends Rect { id: string }

export const OUTER_PADDING = 40

/** The system boundary wraps the scope boundary and every sibling container, with room for its own label. */
export function fitOuterBoundary(inner: Rect, siblings: Rect[]): Rect {
  const all = union([inner, ...siblings])!
  return { x: all.x - OUTER_PADDING, y: all.y - OUTER_PADDING, width: all.width + OUTER_PADDING * 2, height: all.height + OUTER_PADDING * 2 + 8 }
}

export function nodeSize(mode: DisplayMode) {
  return { width: NODE_WIDTH, height: NODE_HEIGHTS[mode] }
}

export function overlaps(a: Rect, b: Rect, margin = 0) {
  return a.x < b.x + b.width + margin && a.x + a.width + margin > b.x && a.y < b.y + b.height + margin && a.y + a.height + margin > b.y
}

export function union(rects: Rect[]): Rect | undefined {
  if (!rects.length) return undefined
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function pad(rect: Rect, amount: number): Rect {
  return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 }
}

export function expandBoundaryToContain(boundary: Rect, box: Rect): Rect {
  const left = Math.max(CANVAS_MARGIN_BOUNDARY, Math.min(boundary.x, box.x - BOUNDARY_PADDING))
  const top = Math.max(CANVAS_MARGIN_BOUNDARY, Math.min(boundary.y, box.y - BOUNDARY_PADDING))
  const right = Math.max(boundary.x + boundary.width, box.x + box.width + BOUNDARY_PADDING)
  const bottom = Math.max(boundary.y + boundary.height, box.y + box.height + BOUNDARY_PADDING)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Boundary that contains every internal box, never shrinking below the stored size. */
export function fitBoundary(stored: Rect | undefined, internal: Rect[]): Rect {
  let boundary = stored ?? DEFAULT_BOUNDARY
  internal.forEach((box) => { boundary = expandBoundaryToContain(boundary, box) })
  return boundary
}

/** Moves a box outside the boundary to the nearest valid side. */
export function keepOutside(box: Rect, boundary: Rect): Position {
  if (!overlaps(box, boundary)) return { x: box.x, y: box.y }
  const gap = 28
  const candidates: Position[] = [
    { x: boundary.x - box.width - gap, y: box.y },
    { x: boundary.x + boundary.width + gap, y: box.y },
    { x: box.x, y: boundary.y - box.height - gap },
    { x: box.x, y: boundary.y + boundary.height + gap },
  ].map((candidate) => ({ x: Math.max(8, candidate.x), y: Math.max(8, candidate.y) }))
  const valid = candidates.filter((candidate) => !overlaps({ ...box, ...candidate }, boundary))
  const options = valid.length ? valid : candidates
  return options.sort((a, b) => Math.hypot(a.x - box.x, a.y - box.y) - Math.hypot(b.x - box.x, b.y - box.y))[0]
}

/** First free slot right of the anchor (or the last box), wrapping to a new row. Never overlaps existing boxes. */
export function nextFreePosition(existing: Rect[], size: { width: number; height: number }, anchor?: Rect, region?: Rect): Position {
  const start = anchor ?? (existing.length ? existing.reduce((last, box) => (box.y > last.y || (box.y === last.y && box.x > last.x) ? box : last)) : undefined)
  const originX = region ? region.x + BOUNDARY_PADDING : 40
  const originY = region ? Math.max(region.y + 40, CANVAS_MARGIN_NODE) : 40
  const limitX = region ? region.x + region.width - BOUNDARY_PADDING : Infinity
  let candidate: Position = start ? { x: start.x + start.width + GAP_X, y: start.y } : { x: originX, y: originY }
  for (let attempts = 0; attempts < 400; attempts += 1) {
    if (candidate.x + size.width > limitX && limitX !== Infinity) {
      candidate = { x: originX, y: candidate.y + size.height + GAP_Y }
    }
    const box = { ...candidate, ...size }
    if (!existing.some((other) => overlaps(box, other, 12))) return candidate
    candidate = { x: candidate.x + size.width + GAP_X, y: candidate.y }
    if (candidate.x > 4000) candidate = { x: originX, y: candidate.y + size.height + GAP_Y }
  }
  return candidate
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'
export type ArrangeMode = 'row' | 'column' | 'grid'

export function alignBoxes(boxes: Box[], mode: AlignMode): Record<string, Position> {
  const bounds = union(boxes)
  if (!bounds) return {}
  const result: Record<string, Position> = {}
  boxes.forEach((box) => {
    let { x, y } = box
    if (mode === 'left') x = bounds.x
    if (mode === 'right') x = bounds.x + bounds.width - box.width
    if (mode === 'centerX') x = bounds.x + bounds.width / 2 - box.width / 2
    if (mode === 'top') y = bounds.y
    if (mode === 'bottom') y = bounds.y + bounds.height - box.height
    if (mode === 'centerY') y = bounds.y + bounds.height / 2 - box.height / 2
    result[box.id] = { x: Math.round(x), y: Math.round(y) }
  })
  return result
}

export function distributeBoxes(boxes: Box[], axis: 'x' | 'y'): Record<string, Position> {
  if (boxes.length < 3) return {}
  const sorted = [...boxes].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const total = axis === 'x' ? last.x + last.width - first.x : last.y + last.height - first.y
  const sizes = sorted.reduce((sum, box) => sum + (axis === 'x' ? box.width : box.height), 0)
  const gap = (total - sizes) / (sorted.length - 1)
  const result: Record<string, Position> = {}
  let cursor = axis === 'x' ? first.x : first.y
  sorted.forEach((box) => {
    result[box.id] = axis === 'x' ? { x: Math.round(cursor), y: box.y } : { x: box.x, y: Math.round(cursor) }
    cursor += (axis === 'x' ? box.width : box.height) + gap
  })
  return result
}

export function arrangeBoxes(boxes: Box[], mode: ArrangeMode, columns = 3, order?: string[]): Record<string, Position> {
  const bounds = union(boxes)
  if (!bounds) return {}
  const rank = new Map((order ?? []).map((id, index) => [id, index]))
  const sorted = [...boxes].sort((a, b) => {
    const ra = rank.get(a.id)
    const rb = rank.get(b.id)
    if (ra !== undefined && rb !== undefined) return ra - rb
    return a.y - b.y || a.x - b.x
  })
  const result: Record<string, Position> = {}
  let x = bounds.x
  let y = bounds.y
  let rowHeight = 0
  sorted.forEach((box, index) => {
    if (mode === 'row') {
      result[box.id] = { x: Math.round(x), y: bounds.y }
      x += box.width + GAP_X
      return
    }
    if (mode === 'column') {
      result[box.id] = { x: bounds.x, y: Math.round(y) }
      y += box.height + GAP_Y
      return
    }
    if (index > 0 && index % columns === 0) {
      x = bounds.x
      y += rowHeight + GAP_Y
      rowHeight = 0
    }
    result[box.id] = { x: Math.round(x), y: Math.round(y) }
    x += box.width + GAP_X
    rowHeight = Math.max(rowHeight, box.height)
  })
  return result
}

export function spaceBoxes(boxes: Box[], delta: number): Record<string, Position> {
  const bounds = union(boxes)
  if (!bounds || boxes.length < 2) return {}
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const factor = 1 + delta
  const result: Record<string, Position> = {}
  boxes.forEach((box) => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    result[box.id] = { x: Math.round(centerX + (cx - centerX) * factor - box.width / 2), y: Math.round(centerY + (cy - centerY) * factor - box.height / 2) }
  })
  return result
}

export interface LayoutEdge { sourceId: string; targetId: string }
export interface LayeredInput {
  nodes: Array<{ id: string; width: number; height: number; role: 'source' | 'internal' | 'sink' }>
  edges: LayoutEdge[]
  spacing?: { x: number; y: number }
}

/** Deterministic layered layout, left to right. External sources land in the first column, external sinks in the last. */
export function layeredLayout(input: LayeredInput): Record<string, Position> {
  const spacingX = input.spacing?.x ?? GAP_X + 40
  const spacingY = input.spacing?.y ?? GAP_Y
  const ids = input.nodes.map((node) => node.id)
  const index = new Map(ids.map((id, position) => [id, position]))
  const successors = new Map<string, string[]>(ids.map((id) => [id, []]))
  const predecessors = new Map<string, string[]>(ids.map((id) => [id, []]))
  input.edges.forEach((edge) => {
    if (!index.has(edge.sourceId) || !index.has(edge.targetId) || edge.sourceId === edge.targetId) return
    successors.get(edge.sourceId)!.push(edge.targetId)
    predecessors.get(edge.targetId)!.push(edge.sourceId)
  })
  // Longest-path layering with cycle protection.
  const layer = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!
    if (visiting.has(id)) return 0
    visiting.add(id)
    const preds = predecessors.get(id) ?? []
    const value = preds.length ? Math.max(...preds.map((pred) => depth(pred) + 1)) : 0
    visiting.delete(id)
    layer.set(id, value)
    return value
  }
  ids.forEach((id) => depth(id))
  // External sources occupy column 0; internal nodes keep their relative depth after it; sinks follow the deepest internal node.
  const hasSources = input.nodes.some((node) => node.role === 'source')
  const internalNodes = input.nodes.filter((node) => node.role === 'internal')
  const minInternal = internalNodes.length ? Math.min(...internalNodes.map((node) => layer.get(node.id) ?? 0)) : 0
  internalNodes.forEach((node) => layer.set(node.id, (layer.get(node.id) ?? 0) - minInternal + (hasSources ? 1 : 0)))
  const maxInternal = internalNodes.length ? Math.max(...internalNodes.map((node) => layer.get(node.id) ?? 0)) : (hasSources ? 0 : -1)
  input.nodes.forEach((node) => {
    if (node.role === 'source') layer.set(node.id, 0)
    if (node.role === 'sink') layer.set(node.id, maxInternal + 1)
  })
  const layers = new Map<number, string[]>()
  ids.forEach((id) => {
    const value = layer.get(id) ?? 0
    layers.set(value, [...(layers.get(value) ?? []), id])
  })
  const orderedLayers = [...layers.keys()].sort((a, b) => a - b)
  // Barycenter ordering, two sweeps.
  const orderInLayer = new Map<string, number>()
  orderedLayers.forEach((value) => layers.get(value)!.forEach((id, position) => orderInLayer.set(id, position)))
  for (let sweep = 0; sweep < 2; sweep += 1) {
    orderedLayers.forEach((value, layerIndex) => {
      if (layerIndex === 0) return
      const members = layers.get(value)!
      const scored = members.map((id) => {
        const preds = predecessors.get(id)!.filter((pred) => (layer.get(pred) ?? 0) < value)
        const score = preds.length ? preds.reduce((sum, pred) => sum + (orderInLayer.get(pred) ?? 0), 0) / preds.length : orderInLayer.get(id) ?? 0
        return { id, score }
      })
      scored.sort((a, b) => a.score - b.score || (index.get(a.id)! - index.get(b.id)!))
      layers.set(value, scored.map((item) => item.id))
      scored.forEach((item, position) => orderInLayer.set(item.id, position))
    })
  }
  const sizes = new Map(input.nodes.map((node) => [node.id, node]))
  const result: Record<string, Position> = {}
  let x = 40
  const columnHeights = orderedLayers.map((value) => layers.get(value)!.reduce((sum, id) => sum + (sizes.get(id)?.height ?? 0) + spacingY, -spacingY))
  const tallest = Math.max(...columnHeights, 0)
  orderedLayers.forEach((value, layerIndex) => {
    const members = layers.get(value)!
    const columnWidth = Math.max(...members.map((id) => sizes.get(id)?.width ?? 0))
    let y = 40 + (tallest - columnHeights[layerIndex]) / 2
    members.forEach((id) => {
      const size = sizes.get(id)!
      result[id] = { x: Math.round(x), y: Math.round(y) }
      y += size.height + spacingY
    })
    x += columnWidth + spacingX
  })
  return result
}

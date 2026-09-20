import type { Position, Rect } from './model'

export interface RouteInput {
  id: string
  source: Rect
  target: Rect
  sourceId: string
  targetId: string
}

export interface Route {
  id: string
  points: Position[]
  labelAt: Position
}

/** sides: leave the source's right, enter the target's left (DFD rule). free: nearest sides, any of the four (C4, ERD). */
export type PortMode = 'sides' | 'free'
type Side = 'left' | 'right' | 'top' | 'bottom'

const PORT_GAP = 24
const LANE_GAP = 28
const CHANNEL_GAP = 14

export function routeEdges(edges: RouteInput[], mode: PortMode = 'free'): Route[] {
  const sideOf = new Map<string, { source: Side; target: Side }>()
  edges.forEach((edge) => {
    if (mode === 'sides') { sideOf.set(edge.id, { source: 'right', target: 'left' }); return }
    const dx = center(edge.target).x - center(edge.source).x
    const dy = center(edge.target).y - center(edge.source).y
    if (Math.abs(dx) >= Math.abs(dy)) sideOf.set(edge.id, dx >= 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' })
    else sideOf.set(edge.id, dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' })
  })
  // Group edges per node side so several connectors on one side spread evenly.
  const usage = new Map<string, RouteInput[]>()
  const key = (nodeId: string, side: Side) => `${nodeId}:${side}`
  edges.forEach((edge) => {
    const sides = sideOf.get(edge.id)!
    usage.set(key(edge.sourceId, sides.source), [...(usage.get(key(edge.sourceId, sides.source)) ?? []), edge])
    usage.set(key(edge.targetId, sides.target), [...(usage.get(key(edge.targetId, sides.target)) ?? []), edge])
  })
  const port = (rect: Rect, side: Side, nodeId: string, edge: RouteInput, other: Rect): Position => {
    const list = usage.get(key(nodeId, side)) ?? [edge]
    const horizontalSide = side === 'left' || side === 'right'
    const sorted = [...list].sort((a, b) => {
      const oa = a.sourceId === nodeId ? a.target : a.source
      const ob = b.sourceId === nodeId ? b.target : b.source
      return horizontalSide ? center(oa).y - center(ob).y : center(oa).x - center(ob).x
    })
    const slot = sorted.indexOf(edge)
    const fraction = (slot + 1) / (sorted.length + 1)
    void other
    if (side === 'left') return { x: rect.x, y: rect.y + rect.height * fraction }
    if (side === 'right') return { x: rect.x + rect.width, y: rect.y + rect.height * fraction }
    if (side === 'top') return { x: rect.x + rect.width * fraction, y: rect.y }
    return { x: rect.x + rect.width * fraction, y: rect.y + rect.height }
  }
  const routes: Route[] = edges.map((edge) => {
    const sides = sideOf.get(edge.id)!
    const start = port(edge.source, sides.source, edge.sourceId, edge, edge.target)
    const end = port(edge.target, sides.target, edge.targetId, edge, edge.source)
    let points: Position[]
    if (sides.source === 'right' && sides.target === 'left') {
      const forward = end.x - start.x >= PORT_GAP * 2
      if (forward) {
        const midX = Math.round(start.x + (end.x - start.x) / 2)
        points = Math.abs(start.y - end.y) < 1 ? [start, end] : [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
      } else {
        // Back edge (sides mode only): step out right, travel above or below both boxes, come in from the left.
        const outX = start.x + PORT_GAP
        const inX = end.x - PORT_GAP
        const above = Math.min(edge.source.y, edge.target.y) - LANE_GAP
        const below = Math.max(edge.source.y + edge.source.height, edge.target.y + edge.target.height) + LANE_GAP
        const laneY = above > 8 ? above : below
        points = [start, { x: outX, y: start.y }, { x: outX, y: laneY }, { x: inX, y: laneY }, { x: inX, y: end.y }, end]
      }
    } else if (sides.source === 'left' && sides.target === 'right') {
      const midX = Math.round(start.x + (end.x - start.x) / 2)
      points = Math.abs(start.y - end.y) < 1 ? [start, end] : [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
    } else {
      const midY = Math.round(start.y + (end.y - start.y) / 2)
      points = Math.abs(start.x - end.x) < 1 ? [start, end] : [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
    }
    return { id: edge.id, points, labelAt: labelPoint(points) }
  })
  return routes
    .map((route, index, all) => ({ ...route, points: separateChannels(route.points, index, all) }))
    .map((route) => ({ ...route, labelAt: labelPoint(route.points) }))
}

function center(rect: Rect): Position {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

interface Segment { i: number; axis: 'x' | 'y'; at: number; from: number; to: number }

function interiorSegments(list: Position[]): Segment[] {
  const segments: Segment[] = []
  for (let i = 1; i < list.length - 2; i += 1) {
    const a = list[i]
    const b = list[i + 1]
    if (Math.abs(a.x - b.x) < 0.5) segments.push({ i, axis: 'x', at: a.x, from: Math.min(a.y, b.y), to: Math.max(a.y, b.y) })
    else if (Math.abs(a.y - b.y) < 0.5) segments.push({ i, axis: 'y', at: a.y, from: Math.min(a.x, b.x), to: Math.max(a.x, b.x) })
  }
  return segments
}

/**
 * Shifts an edge's interior segments sideways when an earlier edge already runs a parallel segment at the
 * same coordinate over an overlapping range, so parallel edges never draw on top of each other.
 */
function separateChannels(points: Position[], index: number, all: Route[]): Position[] {
  const result = points.map((point) => ({ ...point }))
  const earlier = all.slice(0, index).flatMap((route) => interiorSegments(route.points))
  interiorSegments(result).forEach((segment) => {
    let at = segment.at
    for (let guard = 0; guard < 12; guard += 1) {
      const clash = earlier.some((other) => other.axis === segment.axis && Math.abs(other.at - at) < CHANNEL_GAP - 2 && other.from <= segment.to + 6 && other.to >= segment.from - 6)
      if (!clash) break
      at += CHANNEL_GAP
    }
    if (at !== segment.at) {
      if (segment.axis === 'x') { result[segment.i].x = at; result[segment.i + 1].x = at } else { result[segment.i].y = at; result[segment.i + 1].y = at }
    }
  })
  return result
}

function labelPoint(points: Position[]): Position {
  // Midpoint along the whole path keeps labels away from both ports.
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let remaining = total / 2
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const a = points[i]
      const b = points[i + 1]
      const t = lengths[i] ? Math.min(1, remaining / lengths[i]) : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= lengths[i]
  }
  return points[0]
}

export function pathData(points: Position[], radius = 8) {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]
    const current = points[i]
    const next = points[i + 1]
    const inLength = Math.hypot(current.x - prev.x, current.y - prev.y)
    const outLength = Math.hypot(next.x - current.x, next.y - current.y)
    const r = Math.min(radius, inLength / 2, outLength / 2)
    const inX = current.x - Math.sign(current.x - prev.x) * r
    const inY = current.y - Math.sign(current.y - prev.y) * r
    const outX = current.x + Math.sign(next.x - current.x) * r
    const outY = current.y + Math.sign(next.y - current.y) * r
    d += ` L ${inX} ${inY} Q ${current.x} ${current.y} ${outX} ${outY}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

import { useMemo, useState } from 'react'
import { entitiesOfStore, estimateVolume, formatBytes, formatCount, type Element, type EntityClassification, type Project } from '../core/model'
import type { Copy } from './i18n'
import { Icon } from './icons'

export type VolumeMeasure = 'bytes' | 'rows' | 'daily'

const CLASS_COLORS: Record<EntityClassification | 'none', string> = { resource: '#2564a8', event: '#d97706', summary: '#7c3aed', work: '#0891b2', code: '#64748b', none: '#94a3b8' }

interface Bubble { element: Element; value: number; r: number; x: number; y: number; estimated: boolean }

/** Greedy deterministic circle packing: largest first, each next bubble as close to the centre as it fits. */
function pack(items: Array<{ element: Element; value: number; r: number; estimated: boolean }>): Bubble[] {
  const placed: Bubble[] = []
  items.forEach((item) => {
    if (!placed.length) { placed.push({ ...item, x: 0, y: 0 }); return }
    let best: { x: number; y: number; d: number } | undefined
    placed.forEach((anchor) => {
      for (let step = 0; step < 48; step += 1) {
        const angle = (step / 48) * Math.PI * 2
        const distance = anchor.r + item.r + 3
        const x = anchor.x + Math.cos(angle) * distance
        const y = anchor.y + Math.sin(angle) * distance
        const clash = placed.some((other) => Math.hypot(other.x - x, other.y - y) < other.r + item.r + 2)
        const d = Math.hypot(x, y)
        if (!clash && (!best || d < best.d)) best = { x, y, d }
      }
    })
    placed.push({ ...item, x: best?.x ?? 0, y: best?.y ?? 0 })
  })
  return placed
}

export function VolumePanel({ project, storeId, copy, selectedIds, onSelect, onSetHorizon, onClose }: { project: Project; storeId: string; copy: Copy; selectedIds: Set<string>; onSelect: (id: string) => void; onSetHorizon: (months: number) => void; onClose: () => void }) {
  const [measure, setMeasure] = useState<VolumeMeasure>('bytes')
  const horizon = project.settings.volumeHorizonMonths
  const store = project.elements[storeId]
  const bubbles = useMemo(() => {
    const entities = entitiesOfStore(project, storeId)
    const valued = entities.map((element) => {
      const estimate = estimateVolume(element.volume, horizon)
      const value = estimate ? (measure === 'bytes' ? estimate.bytes : measure === 'rows' ? estimate.rows : estimate.dailyWriteRows) : 0
      return { element, value, estimated: Boolean(estimate) }
    })
    const max = Math.max(1, ...valued.map((item) => item.value))
    // Area encodes the value; a floor keeps tiny and unestimated tables visible.
    const sized = valued.map((item) => ({ ...item, r: item.value > 0 ? Math.max(14, Math.sqrt(item.value / max) * 90) : 12 })).sort((a, b) => b.r - a.r)
    return pack(sized)
  }, [horizon, measure, project, storeId])
  const bounds = bubbles.reduce((acc, bubble) => ({ minX: Math.min(acc.minX, bubble.x - bubble.r), maxX: Math.max(acc.maxX, bubble.x + bubble.r), minY: Math.min(acc.minY, bubble.y - bubble.r), maxY: Math.max(acc.maxY, bubble.y + bubble.r) }), { minX: 0, maxX: 0, minY: 0, maxY: 0 })
  const pad = 16
  const width = Math.max(200, bounds.maxX - bounds.minX + pad * 2)
  const height = Math.max(120, bounds.maxY - bounds.minY + pad * 2)
  const total = bubbles.reduce((sum, bubble) => sum + bubble.value, 0)
  const format = (value: number) => (measure === 'bytes' ? formatBytes(value) : formatCount(value))
  const classes = [...new Set(bubbles.map((bubble) => bubble.element.classification ?? 'none'))]
  return (
    <div className="flex min-h-0 flex-col border-t border-line/80 bg-panel/60">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="section-label">{copy.bubbleChart}</span>
          <span className="text-[11px] text-muted">{store?.name} · {copy.estimateAt(horizon)} · {format(total)}</span>
          <label className="flex items-center gap-1 text-[11px] text-muted">{copy.measure}
            <select className="rounded-md border border-line bg-ink/60 px-2 py-1 text-[11px]" value={measure} onChange={(event) => setMeasure(event.target.value as VolumeMeasure)}>
              {(['bytes', 'rows', 'daily'] as VolumeMeasure[]).map((option) => <option key={option} value={option}>{copy.measures[option]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted">{copy.horizon}
            <input type="number" min="1" className="w-16 rounded-md border border-line bg-ink/60 px-2 py-1 text-[11px]" value={horizon} onChange={(event) => onSetHorizon(Math.max(1, Number(event.target.value) || 1))} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          {classes.map((cls) => <span key={cls} className="flex items-center gap-1 text-[10px] text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CLASS_COLORS[cls] }} />{cls === 'none' ? copy.noClassification : copy.classifications[cls]}</span>)}
          <button type="button" className="text-muted hover:text-base-content" onClick={onClose} aria-label="close"><Icon name="x" size={14} /></button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto px-4 pb-3">
        <svg width={width} height={height} viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${width} ${height}`} className="mx-auto block">
          {bubbles.map((bubble) => {
            const selected = selectedIds.has(bubble.element.id)
            const color = CLASS_COLORS[bubble.element.classification ?? 'none']
            const labelFits = bubble.r >= 26
            return (
              <g key={bubble.element.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(bubble.element.id)}>
                <title>{`${bubble.element.name}: ${bubble.estimated ? format(bubble.value) : copy.noVolumeYet}`}</title>
                <circle cx={bubble.x} cy={bubble.y} r={bubble.r} fill={color} fillOpacity={bubble.estimated ? 0.85 : 0.15} stroke={selected ? '#55d5e6' : color} strokeWidth={selected ? 3 : 1} strokeDasharray={bubble.estimated ? undefined : '4 3'} />
                {labelFits && <text x={bubble.x} y={bubble.y - 2} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">{bubble.element.name}</text>}
                {labelFits && <text x={bubble.x} y={bubble.y + 11} textAnchor="middle" fill="#ffffff" fontSize="9.5" opacity="0.9">{bubble.estimated ? format(bubble.value) : copy.noVolumeYet}</text>}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

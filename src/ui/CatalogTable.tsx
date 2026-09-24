import { useMemo, useState, type ReactNode } from 'react'
import { toCsv, toMarkdown, type Cell } from '../core/tabular'
import { downloadBlob } from './exporters'
import type { Copy } from './i18n'
import { Icon } from './icons'

export interface CatalogColumn<T> {
  id: string
  label: string
  value: (row: T) => Cell
  render?: (row: T) => ReactNode
  numeric?: boolean
  mono?: boolean
  hiddenByDefault?: boolean
}

function readHidden(storageKey: string, fallback: string[]): string[] {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? (JSON.parse(saved) as string[]) : fallback
  } catch {
    return fallback
  }
}

/** CSV and Markdown downloads of the rows as shown. */
export function ExportButtons({ copy, name, headers, rows }: { copy: Copy; name: string; headers: string[]; rows: Cell[][] }) {
  const save = (format: 'csv' | 'md') => downloadBlob(new Blob([format === 'csv' ? `﻿${toCsv(headers, rows)}` : toMarkdown(headers, rows)], { type: format === 'csv' ? 'text/csv' : 'text/markdown' }), `${name}.${format}`)
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <Icon name="download" size={12} className="text-muted" />
      <button type="button" className="rounded px-1.5 py-0.5 text-muted hover:bg-white/5 hover:text-cyan" onClick={() => save('csv')}>CSV</button>
      <button type="button" className="rounded px-1.5 py-0.5 text-muted hover:bg-white/5 hover:text-cyan" onClick={() => save('md')}>{copy.catalog.markdown}</button>
    </span>
  )
}

/**
 * A derived, read-only catalog list: sort by any column, pick the columns (remembered per browser),
 * and export the visible columns of the filtered rows.
 */
export function CatalogTable<T>({ columns, rows, rowKey, onRowClick, storageKey, exportName, copy, toolbar, selectedKey, empty }: { columns: Array<CatalogColumn<T>>; rows: T[]; rowKey: (row: T) => string; onRowClick: (row: T) => void; storageKey: string; exportName: string; copy: Copy; toolbar?: ReactNode; selectedKey?: string; empty: string }) {
  const [hidden, setHiddenState] = useState<string[]>(() => readHidden(storageKey, columns.filter((column) => column.hiddenByDefault).map((column) => column.id)))
  const [sort, setSort] = useState<{ id: string; direction: 1 | -1 } | null>(null)
  const [picker, setPicker] = useState(false)
  const setHidden = (next: string[]) => {
    setHiddenState(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* the choice lasts this session */ }
  }
  const visible = columns.filter((column) => !hidden.includes(column.id))
  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((item) => item.id === sort.id)
    if (!column) return rows
    return [...rows].sort((a, b) => {
      const left = column.value(a)
      const right = column.value(b)
      if (typeof left === 'number' || typeof right === 'number') return ((Number(left ?? -Infinity) || 0) - (Number(right ?? -Infinity) || 0)) * sort.direction
      return String(left ?? '').localeCompare(String(right ?? '')) * sort.direction
    })
  }, [columns, rows, sort])
  const toggleSort = (id: string) => setSort((current) => (current?.id === id ? (current.direction === 1 ? { id, direction: -1 } : null) : { id, direction: 1 }))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-4 py-2 text-xs">
        {toolbar}
        <span className="ml-auto text-[11px] text-muted">{copy.catalog.rows(sorted.length)}</span>
        <div className="relative">
          <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-white/5 hover:text-base-content" onClick={() => setPicker((value) => !value)}><Icon name="column" size={12} />{copy.catalog.columns}</button>
          {picker && (
            <div className="absolute right-0 top-7 z-30 w-52 rounded-xl border border-line bg-panel p-2 shadow-glow" onMouseLeave={() => setPicker(false)}>
              {columns.map((column) => (
                <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-white/5">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={!hidden.includes(column.id)} onChange={() => setHidden(hidden.includes(column.id) ? hidden.filter((id) => id !== column.id) : [...hidden, column.id])} />{column.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <ExportButtons copy={copy} name={exportName} headers={visible.map((column) => column.label)} rows={sorted.map((row) => visible.map((column) => column.value(row)))} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-panel text-left text-[10px] uppercase tracking-wider text-muted">
            <tr>
              {visible.map((column) => (
                <th key={column.id} className={`cursor-pointer select-none whitespace-nowrap px-3 py-1.5 hover:text-base-content ${column.numeric ? 'text-right' : ''}`} onClick={() => toggleSort(column.id)}>
                  {column.label}{sort?.id === column.id ? (sort.direction === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const key = rowKey(row)
              return (
                <tr key={key} className={`cursor-pointer border-b border-line/40 ${key === selectedKey ? 'bg-cyan/10' : 'hover:bg-white/[0.03]'}`} onClick={() => onRowClick(row)}>
                  {visible.map((column) => <td key={column.id} className={`max-w-[18rem] truncate px-3 py-1 ${column.numeric ? 'text-right tabular-nums' : ''} ${column.mono ? 'font-mono text-[11px]' : ''}`}>{column.render ? column.render(row) : String(column.value(row) ?? '')}</td>)}
                </tr>
              )
            })}
            {!sorted.length && <tr><td colSpan={visible.length || 1} className="px-3 py-6 text-center text-muted">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

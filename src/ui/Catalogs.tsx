import { useMemo, useState } from 'react'
import { dfdRows, tableRows, type DfdRow, type TableRow } from '../core/catalog'
import { ENTITY_CLASSIFICATIONS, formatBytes, isErdStore, type NameMode, type Project } from '../core/model'
import type { Finding } from '../core/validate'
import { bindName } from '../core/vocabulary'
import { CatalogTable, type CatalogColumn } from './CatalogTable'
import type { Copy } from './i18n'
import { Icon } from './icons'

const LEVEL_DOT: Record<Finding['level'], string> = { error: 'bg-rose-400', warning: 'bg-amber', info: 'bg-cyan/70' }
type LevelFilter = '' | Finding['level']

function FindingCell({ count, level }: { count: number; level?: Finding['level'] }) {
  if (!count) return <span className="text-muted">0</span>
  return <span className="inline-flex items-center gap-1">{level && <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[level]}`} />}{count}</span>
}

const select = 'rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]'

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="flex items-center gap-1.5 rounded-lg border border-line bg-ink/45 px-2 py-1 text-xs text-muted"><Icon name="search" size={12} /><input className="w-40 bg-transparent text-base-content outline-none" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

const meetsLevel = (level: LevelFilter, worst?: Finding['level']) => !level || (worst !== undefined && ['error', 'warning', 'info'].indexOf(worst) <= ['error', 'warning', 'info'].indexOf(level))

/** Every table across every data store (requirement: project-catalogs tables). */
export function TablesCatalog({ project, copy, findings, nameMode, selectedId, onOpen }: { project: Project; copy: Copy; findings: Finding[]; nameMode: NameMode; selectedId?: string; onOpen: (entityId: string) => void }) {
  const [search, setSearch] = useState('')
  const [storeId, setStoreId] = useState('')
  const [classification, setClassification] = useState('')
  const [dialect, setDialect] = useState('')
  const [level, setLevel] = useState<LevelFilter>('')
  const all = useMemo(() => tableRows(project, findings, nameMode), [findings, nameMode, project])
  const stores = Object.values(project.elements).filter(isErdStore).sort((a, b) => a.name.localeCompare(b.name))
  const rows = all.filter((row) => {
    if (storeId && row.store.id !== storeId) return false
    if (classification && row.classification !== classification) return false
    if (dialect && row.dialect !== dialect) return false
    if (!meetsLevel(level, row.worstLevel)) return false
    if (!search) return true
    // Search reads every name form, whatever the display mode (requirement: project-catalogs).
    const binding = bindName(project, row.entity.name)
    return [row.entity.name, binding.system, binding.physical ?? '', row.store.name, row.entity.description].join(' ').toLowerCase().includes(search.toLowerCase())
  })
  const columns: Array<CatalogColumn<TableRow>> = [
    { id: 'name', label: copy.catalog.table, value: (row) => row.name, render: (row) => <span className="font-semibold">{row.name}</span> },
    { id: 'physical', label: copy.dict.physicalName, value: (row) => row.physical, mono: true },
    { id: 'store', label: copy.catalog.store, value: (row) => row.store.name },
    { id: 'dialect', label: copy.sqlDialect, value: (row) => row.dialect },
    { id: 'classification', label: copy.classification, value: (row) => (row.classification ? copy.classifications[row.classification as keyof typeof copy.classifications] : '') },
    { id: 'storage', label: copy.storageKind, value: (row) => copy.storages[row.storage as keyof typeof copy.storages], hiddenByDefault: true },
    { id: 'owner', label: copy.catalog.owner, value: (row) => row.owner },
    { id: 'primaryKey', label: copy.primaryKey, value: (row) => row.primaryKey, mono: true, hiddenByDefault: true },
    { id: 'fields', label: copy.dict.fields, value: (row) => row.fields, numeric: true },
    { id: 'important', label: copy.important, value: (row) => row.importantFields, numeric: true, hiddenByDefault: true },
    { id: 'reads', label: copy.catalog.reads, value: (row) => row.dfdReads, numeric: true },
    { id: 'writes', label: copy.catalog.writes, value: (row) => row.dfdWrites, numeric: true },
    { id: 'dfds', label: copy.dfds, value: (row) => row.dfds, numeric: true, hiddenByDefault: true },
    { id: 'size', label: copy.catalog.size, value: (row) => row.bytes ?? null, render: (row) => (row.bytes === undefined ? <span className="text-muted">—</span> : formatBytes(row.bytes)), numeric: true },
    { id: 'findings', label: copy.catalog.findings, value: (row) => row.findings, render: (row) => <FindingCell count={row.findings} level={row.worstLevel} />, numeric: true },
  ]
  return (
    <CatalogTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.entity.id}
      selectedKey={selectedId}
      onRowClick={(row) => onOpen(row.entity.id)}
      storageKey="archidiag-catalog-tables"
      exportName={`${project.name}-tables`}
      copy={copy}
      empty={copy.catalog.noTables}
      toolbar={
        <>
          <SearchBox value={search} onChange={setSearch} placeholder={copy.catalog.searchTables} />
          <select className={select} value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">{copy.catalog.allStores}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select>
          <select className={select} value={classification} onChange={(event) => setClassification(event.target.value)}><option value="">{copy.catalog.anyClassification}</option>{ENTITY_CLASSIFICATIONS.map((option) => <option key={option} value={option}>{copy.classifications[option]}</option>)}</select>
          <select className={select} value={dialect} onChange={(event) => setDialect(event.target.value)}><option value="">{copy.catalog.anyDialect}</option><option value="postgresql">PostgreSQL</option><option value="sqlite">SQLite</option><option value="mysql">MySQL</option></select>
          <select className={select} value={level} onChange={(event) => setLevel(event.target.value as LevelFilter)}><option value="">{copy.catalog.anyFinding}</option><option value="error">{copy.catalog.levelAtLeast.error}</option><option value="warning">{copy.catalog.levelAtLeast.warning}</option><option value="info">{copy.catalog.levelAtLeast.info}</option></select>
        </>
      }
    />
  )
}

/** Every DFD with its scope, use case, and size (requirement: project-catalogs dfds). */
export function DfdsCatalog({ project, copy, findings, onOpen }: { project: Project; copy: Copy; findings: Finding[]; onOpen: (viewId: string) => void }) {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<LevelFilter>('')
  const all = useMemo(() => dfdRows(project, findings), [findings, project])
  const rows = all.filter((row) => meetsLevel(level, row.worstLevel) && (!search || `${row.useCase} ${row.scope}`.toLowerCase().includes(search.toLowerCase())))
  const columns: Array<CatalogColumn<DfdRow>> = [
    { id: 'useCase', label: copy.catalog.useCase, value: (row) => row.useCase || copy.viewKinds.dfd_container, render: (row) => <span className="font-semibold">{row.useCase || copy.viewKinds.dfd_container}</span> },
    { id: 'scope', label: copy.catalog.scope, value: (row) => row.scope },
    { id: 'processes', label: copy.catalog.processes, value: (row) => row.processes, numeric: true },
    { id: 'stores', label: copy.catalog.stores, value: (row) => row.stores, numeric: true },
    { id: 'nodes', label: copy.catalog.nodes, value: (row) => row.nodes, numeric: true, hiddenByDefault: true },
    { id: 'flows', label: copy.catalog.flows, value: (row) => row.flows, numeric: true },
    { id: 'boundaries', label: copy.catalog.boundaries, value: (row) => row.boundaries, numeric: true },
    { id: 'unplaced', label: copy.catalog.unplaced, value: (row) => row.unplaced, numeric: true },
    { id: 'findings', label: copy.catalog.findings, value: (row) => row.findings, render: (row) => <FindingCell count={row.findings} level={row.worstLevel} />, numeric: true },
  ]
  return (
    <CatalogTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.viewId}
      onRowClick={(row) => onOpen(row.viewId)}
      storageKey="archidiag-catalog-dfds"
      exportName={`${project.name}-dfds`}
      copy={copy}
      empty={copy.catalog.noDfds}
      toolbar={
        <>
          <SearchBox value={search} onChange={setSearch} placeholder={copy.catalog.searchDfds} />
          <select className={select} value={level} onChange={(event) => setLevel(event.target.value as LevelFilter)}><option value="">{copy.catalog.anyFinding}</option><option value="error">{copy.catalog.levelAtLeast.error}</option><option value="warning">{copy.catalog.levelAtLeast.warning}</option><option value="info">{copy.catalog.levelAtLeast.info}</option></select>
        </>
      }
    />
  )
}

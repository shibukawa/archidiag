import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ApplicationKind, ContainerCategory, DataStoreKind, DiagramView, ElementKind, Group, SqlDialect } from '../core/model'
import { APPLICATION_KINDS, childKindForView, DATA_STORE_KINDS, LEVEL_BY_VIEW_KIND, SQL_STORE_KINDS } from '../core/model'
import { RadioRow } from './Inspector'
import type { Copy } from './i18n'
import { Icon } from './icons'

export interface QuickCreateInput {
  name: string
  description: string
  kind: ElementKind
  containerCategory?: ContainerCategory
  applicationKind?: ApplicationKind
  dataStoreKind?: DataStoreKind
  sqlDialect?: SqlDialect
  groupId?: string
}

interface Defaults {
  kind: ElementKind
  containerCategory: ContainerCategory
  applicationKind: ApplicationKind
  dataStoreKind: DataStoreKind
  sqlDialect: SqlDialect
  groupId: string
}

const remembered = new Map<string, Defaults>()

export function QuickCreate({ view, groups, copy, onCreate, onClose }: { view: DiagramView; groups: Group[]; copy: Copy; onCreate: (input: QuickCreateInput) => void; onClose: () => void }) {
  const level = LEVEL_BY_VIEW_KIND[view.kind]
  const kindOptions: ElementKind[] = level === 'context' ? ['softwareSystem', 'person', 'externalSystem'] : level === 'container' ? ['container'] : [childKindForView(view.kind)]
  const [defaults, setDefaults] = useState<Defaults>(() => remembered.get(view.kind) ?? { kind: kindOptions[0], containerCategory: 'application', applicationKind: 'server', dataStoreKind: 'database', sqlDialect: 'postgresql', groupId: '' })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [count, setCount] = useState(0)
  const nameRef = useRef<HTMLInputElement>(null)
  const composing = useRef(false)

  useEffect(() => { nameRef.current?.focus() }, [])
  useEffect(() => { remembered.set(view.kind, defaults) }, [defaults, view.kind])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate({
      name: trimmed,
      description: description.trim(),
      kind: defaults.kind,
      ...(defaults.kind === 'container' ? { containerCategory: defaults.containerCategory, ...(defaults.containerCategory === 'application' ? { applicationKind: defaults.applicationKind } : {}), ...(defaults.containerCategory === 'dataStore' ? { dataStoreKind: defaults.dataStoreKind, ...(SQL_STORE_KINDS.includes(defaults.dataStoreKind) ? { sqlDialect: defaults.sqlDialect } : {}) } : {}) } : {}),
      ...(defaults.groupId && groups.some((group) => group.id === defaults.groupId) ? { groupId: defaults.groupId } : {}),
    })
    setName('')
    setDescription('')
    setCount((value) => value + 1)
    nameRef.current?.focus()
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { onClose(); return }
    if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing) { event.preventDefault(); submit() }
  }

  const select = 'inspector-input py-1.5 text-xs'
  void select
  return (
    <div className="absolute left-4 top-4 z-30 w-[300px] rounded-xl border border-line bg-panel p-3 shadow-glow" onPointerDown={(event) => event.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between">
        <div className="section-label">{copy.quickCreate}{count ? ` · ${count}` : ''}</div>
        <button type="button" className="text-muted hover:text-base-content" onClick={onClose} aria-label={copy.cancel}><Icon name="x" size={14} /></button>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        {kindOptions.length > 1 && (
          <label className="col-span-2 text-[10px] text-muted">{copy.kind}
            <select className={select} value={defaults.kind} onChange={(event) => setDefaults({ ...defaults, kind: event.target.value as ElementKind })}>
              {kindOptions.map((kind) => <option key={kind} value={kind}>{copy.kinds[kind]}</option>)}
            </select>
          </label>
        )}
        {defaults.kind === 'container' && (
          <>
            <div className="col-span-2 text-[10px] text-muted">{copy.containerCategory}
              <div className="mt-1"><RadioRow name="qc-category" value={defaults.containerCategory} options={(['application', 'dataStore'] as ContainerCategory[]).map((option) => [option, copy.categories[option]])} onChange={(value) => setDefaults({ ...defaults, containerCategory: value as ContainerCategory })} /></div>
            </div>
            {defaults.containerCategory === 'application' && (
              <div className="col-span-2 text-[10px] text-muted">{copy.applicationKind}
                <div className="mt-1"><RadioRow name="qc-app" value={defaults.applicationKind} options={APPLICATION_KINDS.map((option) => [option, copy.applicationKinds[option]])} onChange={(value) => setDefaults({ ...defaults, applicationKind: value as ApplicationKind })} /></div>
              </div>
            )}
            {defaults.containerCategory === 'dataStore' && (
              <div className="col-span-2 text-[10px] text-muted">{copy.dataStoreKind}
                <div className="mt-1"><RadioRow name="qc-store" value={defaults.dataStoreKind} options={DATA_STORE_KINDS.map((option) => [option, copy.dataStoreKinds[option]])} onChange={(value) => setDefaults({ ...defaults, dataStoreKind: value as DataStoreKind })} /></div>
              </div>
            )}
            {defaults.containerCategory === 'dataStore' && SQL_STORE_KINDS.includes(defaults.dataStoreKind) && (
              <div className="col-span-2 text-[10px] text-muted">{copy.sqlDialect}
                <div className="mt-1"><RadioRow name="qc-dialect" value={defaults.sqlDialect} options={[['postgresql', 'PostgreSQL'], ['sqlite', 'SQLite'], ['mysql', 'MySQL']]} onChange={(value) => setDefaults({ ...defaults, sqlDialect: value as SqlDialect })} /></div>
              </div>
            )}
          </>
        )}
        {groups.length > 0 && (
          <label className="col-span-2 text-[10px] text-muted">{copy.group}
            <select className={select} value={defaults.groupId} onChange={(event) => setDefaults({ ...defaults, groupId: event.target.value })}>
              <option value="">{copy.noGroup}</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <input
        ref={nameRef}
        className="inspector-input mb-2"
        placeholder={copy.namePlaceholder}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKey}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={() => { composing.current = false }}
      />
      <input className="inspector-input mb-2 text-xs" placeholder={copy.descriptionPlaceholder} value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={onKey} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} />
      <p className="text-[10px] leading-4 text-muted">{copy.quickCreateHint}</p>
    </div>
  )
}

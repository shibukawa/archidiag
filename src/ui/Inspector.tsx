import { ancestorIds, APPLICATION_KINDS, childrenOf, childViewKind, DATA_STORE_KINDS, effectiveCategory, LEVEL_BY_VIEW_KIND, SQL_STORE_KINDS, type ApplicationKind, type ContainerCategory, type DataStoreKind, type DiagramView, type Element, type Group, type Project, type Relationship, type SqlDialect } from '../core/model'
import { scopeElements } from '../core/views'
import type { Copy } from './i18n'
import { roleLabel } from './i18n'
import { Icon } from './icons'

export interface InspectorProps {
  project: Project
  view: DiagramView
  selectedIds: Set<string>
  copy: Copy
  groups: Group[]
  onPatchElement: (id: string, patch: Partial<Element>) => void
  onPatchRelationship: (id: string, patch: Partial<Relationship>) => void
  onDeleteElements: (ids: string[]) => void
  onDeleteRelationship: (id: string) => void
  onOpenScope: (kind: DiagramView['kind'], scopeId: string | null) => void
  onPatchView: (patch: Partial<DiagramView>) => void
  onCreateGroup: (name: string) => void
  onPatchGroup: (id: string, patch: Partial<Group>) => void
  onDeleteGroup: (id: string) => void
  onCopyLink: () => void
  onSelect: (id: string) => void
}

export function Inspector(props: InspectorProps) {
  const { project, view, selectedIds, copy } = props
  const ids = [...selectedIds]
  const elements = ids.map((id) => project.elements[id]).filter(Boolean)
  const relationship = ids.length === 1 ? project.relationships[ids[0]] : undefined
  return (
    <aside className="flex min-h-0 flex-col border-l border-line/80 bg-panel/45">
      <div className="flex items-center justify-between border-b border-line/80 px-4 py-3">
        <div className="section-label">{copy.inspector}</div>
        <button type="button" className="flex items-center gap-1 text-[11px] text-muted hover:text-cyan" onClick={props.onCopyLink} title={copy.copyLink}><Icon name="link" size={12} />{copy.copyLink}</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {elements.length === 1 && <ElementEditor {...props} element={elements[0]} />}
        {elements.length > 1 && <MultiSelection {...props} elements={elements} />}
        {relationship && <RelationshipEditor {...props} relationship={relationship} />}
        {elements.length === 0 && !relationship && <ViewEditor {...props} />}
      </div>
    </aside>
  )
}

export function RadioRow({ name, value, options, onChange }: { name: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([option, label]) => (
        <label key={option} className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] ${value === option ? 'border-cyan bg-cyan/15 text-cyan' : 'border-line text-muted hover:border-muted hover:text-base-content'}`}>
          <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="sr-only" />
          {label}
        </label>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mb-3 block text-[10px] font-semibold uppercase tracking-wider text-muted">{label}<div className="mt-1 normal-case tracking-normal">{children}</div></label>
}

function ElementEditor({ project, view, element, copy, groups, onPatchElement, onDeleteElements, onOpenScope, onSelect }: InspectorProps & { element: Element }) {
  const kind = childViewKind(element)
  const related = Object.values(project.relationships).filter((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id)
  const scopeGroups = groups.filter((group) => group.scopeId === (element.parentId ?? null))
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
        <span className="font-semibold">{roleLabel(copy, element)}</span>
        {kind && <button type="button" className="ml-auto flex items-center gap-1 text-cyan hover:underline" onClick={() => onOpenScope(kind, element.id)}><Icon name="external" size={12} />{copy.open}</button>}
      </div>
      <Field label={copy.name}><input className="inspector-input" value={element.name} onChange={(event) => onPatchElement(element.id, { name: event.target.value })} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[72px]" value={element.description} onChange={(event) => onPatchElement(element.id, { description: event.target.value })} /></Field>
      <Field label={copy.technology}><input className="inspector-input" value={element.technology} onChange={(event) => onPatchElement(element.id, { technology: event.target.value })} /></Field>
      {element.kind === 'container' && (
        <>
          <Field label={copy.containerCategory}>
            <RadioRow name={`category-${element.id}`} value={effectiveCategory(element)} options={(['application', 'dataStore'] as ContainerCategory[]).map((option) => [option, copy.categories[option]])} onChange={(value) => { const category = value as ContainerCategory; onPatchElement(element.id, { containerCategory: category, dataStoreKind: category === 'dataStore' ? element.dataStoreKind ?? 'database' : undefined, sqlDialect: category === 'dataStore' ? element.sqlDialect : undefined }) }} />
          </Field>
          {effectiveCategory(element) === 'application' && (
            <Field label={copy.applicationKind}>
              <RadioRow name={`app-${element.id}`} value={element.applicationKind ?? 'other'} options={APPLICATION_KINDS.map((option) => [option, copy.applicationKinds[option]])} onChange={(value) => onPatchElement(element.id, { applicationKind: value as ApplicationKind })} />
            </Field>
          )}
          {effectiveCategory(element) === 'dataStore' && (
            <Field label={copy.dataStoreKind}>
              <RadioRow name={`store-${element.id}`} value={element.dataStoreKind ?? 'database'} options={DATA_STORE_KINDS.map((option) => [option, copy.dataStoreKinds[option]])} onChange={(value) => onPatchElement(element.id, { dataStoreKind: value as DataStoreKind, sqlDialect: SQL_STORE_KINDS.includes(value as DataStoreKind) ? element.sqlDialect : undefined })} />
            </Field>
          )}
          {effectiveCategory(element) === 'dataStore' && element.dataStoreKind && SQL_STORE_KINDS.includes(element.dataStoreKind) && (
            <Field label={copy.sqlDialect}>
              <select className="inspector-input" value={element.sqlDialect ?? ''} onChange={(event) => onPatchElement(element.id, { sqlDialect: (event.target.value || undefined) as SqlDialect | undefined })}>
                <option value="">—</option><option value="postgresql">PostgreSQL</option><option value="sqlite">SQLite</option><option value="mysql">MySQL</option>
              </select>
            </Field>
          )}
        </>
      )}
      {scopeGroups.length > 0 && (
        <Field label={copy.group}>
          <select className="inspector-input" value={element.groupId ?? ''} onChange={(event) => onPatchElement(element.id, { groupId: event.target.value || undefined })}>
            <option value="">{copy.noGroup}</option>
            {scopeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </Field>
      )}
      <Field label={copy.parentScope}>
        <div className="text-xs text-muted">{element.parentId ? project.elements[element.parentId]?.name : copy.projectRoot}</div>
      </Field>
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.relationships} · {related.length}</div>
        {related.map((relationship) => {
          const outgoing = relationship.sourceId === element.id
          const other = project.elements[outgoing ? relationship.targetId : relationship.sourceId]
          return (
            <button key={relationship.id} type="button" onClick={() => onSelect(relationship.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">
              <span className="text-[10px]">{outgoing ? '→' : '←'}</span>
              <span className="truncate">{other?.name ?? '?'}</span>
              <span className="ml-auto truncate text-[10px] italic">{relationship.label}</span>
            </button>
          )
        })}
        <p className="mt-1 text-[10px] text-muted">{copy.connectHint}</p>
      </div>
      <div className="text-[10px] text-muted">{copy.view}: {view.name || copy.defaultView}</div>
      <button type="button" className="btn btn-ghost btn-sm mt-4 w-full justify-start text-rose-400 hover:bg-rose-500/10" onClick={() => onDeleteElements([element.id])}><Icon name="trash" size={14} />{copy.deleteElement}</button>
    </div>
  )
}

function MultiSelection({ elements, copy, onDeleteElements }: InspectorProps & { elements: Element[] }) {
  return (
    <div>
      <div className="mb-3 text-xs text-muted">{elements.length} × {copy.kinds[elements[0].kind]}</div>
      <ul className="mb-4 space-y-1 text-xs">{elements.map((element) => <li key={element.id} className="truncate">{element.name}</li>)}</ul>
      <button type="button" className="btn btn-ghost btn-sm w-full justify-start text-rose-400 hover:bg-rose-500/10" onClick={() => onDeleteElements(elements.map((element) => element.id))}><Icon name="trash" size={14} />{copy.deleteElement}</button>
    </div>
  )
}

function RelationshipEditor({ project, view, relationship, copy, onPatchRelationship, onDeleteRelationship, onSelect }: InspectorProps & { relationship: Relationship }) {
  const source = project.elements[relationship.sourceId]
  const target = project.elements[relationship.targetId]
  const level = LEVEL_BY_VIEW_KIND[view.kind]
  const mapping = level === 'context' ? undefined : (relationship.viewEndpoints?.[level] ?? (level === 'component' ? relationship.viewEndpoints?.container : undefined))
  const effectiveSource = mapping?.sourceId ?? relationship.sourceId
  const effectiveTarget = mapping?.targetId ?? relationship.targetId
  // When an effective endpoint is the scope (or an ancestor of it), the edge hangs on the boundary until assigned to a child.
  const scopeChain = new Set(ancestorIds(project, view.scopeId))
  const boundarySide: 'source' | 'target' | undefined = level !== 'context' && view.scopeId && scopeChain.has(effectiveSource) ? 'source' : level !== 'context' && view.scopeId && scopeChain.has(effectiveTarget) ? 'target' : undefined
  const children = view.scopeId ? childrenOf(project, view.scopeId) : []
  // Other relationships drawn on the same line (same canonical endpoints and direction).
  const siblingsOnLine = Object.values(project.relationships).filter((other) => other.id !== relationship.id && other.sourceId === relationship.sourceId && other.targetId === relationship.targetId)
  const assign = (childId: string) => {
    if (!boundarySide || level === 'context') return
    const next = { sourceId: boundarySide === 'source' ? childId || (view.scopeId as string) : effectiveSource, targetId: boundarySide === 'target' ? childId || (view.scopeId as string) : effectiveTarget }
    onPatchRelationship(relationship.id, { viewEndpoints: { ...relationship.viewEndpoints, [level]: next } })
  }
  return (
    <div>
      <div className="mb-4 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
        <div className="section-label mb-1">{copy.relationship}</div>
        <button type="button" className="hover:text-cyan" onClick={() => onSelect(relationship.sourceId)}>{source?.name}</button>
        <span className="mx-1 text-muted">→</span>
        <button type="button" className="hover:text-cyan" onClick={() => onSelect(relationship.targetId)}>{target?.name}</button>
      </div>
      <Field label={copy.label}><input className="inspector-input" value={relationship.label} onChange={(event) => onPatchRelationship(relationship.id, { label: event.target.value })} /></Field>
      <Field label={copy.technology}><input className="inspector-input" value={relationship.technology ?? ''} onChange={(event) => onPatchRelationship(relationship.id, { technology: event.target.value })} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[60px]" value={relationship.description ?? ''} onChange={(event) => onPatchRelationship(relationship.id, { description: event.target.value })} /></Field>
      {siblingsOnLine.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.sameLine}</div>
          {siblingsOnLine.map((other) => (
            <button key={other.id} type="button" onClick={() => onSelect(other.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">
              <span className="truncate italic">{other.label || '—'}</span>
              {other.technology && <span className="ml-auto truncate text-[10px]">[{other.technology}]</span>}
            </button>
          ))}
        </div>
      )}
      {boundarySide && children.length > 0 && (
        <Field label={copy.assignEndpoint}>
          <select className="inspector-input" value={boundarySide === 'source' ? (children.some((child) => child.id === effectiveSource) ? effectiveSource : '') : (children.some((child) => child.id === effectiveTarget) ? effectiveTarget : '')} onChange={(event) => assign(event.target.value)}>
            <option value="">{copy.unassigned}</option>
            {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
          <p className="mt-1 text-[10px] leading-4 text-muted">{copy.assignEndpointHint}</p>
        </Field>
      )}
      <button type="button" className="btn btn-ghost btn-sm mt-2 w-full justify-start text-rose-400 hover:bg-rose-500/10" onClick={() => onDeleteRelationship(relationship.id)}><Icon name="trash" size={14} />{copy.deleteRelationship}</button>
    </div>
  )
}

function ViewEditor({ project, view, copy, groups, onPatchView, onCreateGroup, onPatchGroup, onDeleteGroup }: InspectorProps) {
  const scoped = scopeElements(project, { ...view, elementRefs: [] })
  const shown = new Set(view.elementRefs.length ? view.elementRefs : scoped.map((element) => element.id))
  const toggle = (id: string) => {
    const next = new Set(shown)
    if (next.has(id)) next.delete(id); else next.add(id)
    onPatchView({ elementRefs: next.size === scoped.length ? [] : [...next] })
  }
  const scopeGroups = groups.filter((group) => group.scopeId === view.scopeId)
  return (
    <div>
      <div className="mb-3 text-xs text-muted">{copy.selectHint}</div>
      <Field label={copy.viewName}><input className="inspector-input" value={view.name} onChange={(event) => onPatchView({ name: event.target.value })} placeholder={copy.defaultView} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[56px]" value={view.description} onChange={(event) => onPatchView({ description: event.target.value })} /></Field>
      <div className="mb-4">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.showInView} · {shown.size}/{scoped.length}</div>
        {scoped.map((element) => (
          <label key={element.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-white/5">
            <input type="checkbox" className="checkbox checkbox-xs" checked={shown.has(element.id)} onChange={() => toggle(element.id)} />
            <span className="truncate">{element.name}</span>
          </label>
        ))}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.groups}</div>
        <button type="button" className="text-[11px] text-cyan hover:underline" onClick={() => onCreateGroup(copy.newGroup)}>+ {copy.newGroup}</button>
      </div>
      {scopeGroups.map((group) => (
        <div key={group.id} className="mb-1 flex items-center gap-1">
          <input className="inspector-input py-1 text-xs" value={group.name} onChange={(event) => onPatchGroup(group.id, { name: event.target.value })} />
          <input type="color" className="h-7 w-7 cursor-pointer rounded border border-line bg-transparent" value={group.color ?? '#9ca3af'} onChange={(event) => onPatchGroup(group.id, { color: event.target.value })} title={copy.group} />
          <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-rose-500/10 hover:text-rose-400" onClick={() => onDeleteGroup(group.id)} title={copy.deleteGroup}><Icon name="trash" size={13} /></button>
        </div>
      ))}
    </div>
  )
}

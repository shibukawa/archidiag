import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ancestorIds, APPLICATION_KINDS, CARDINALITIES, childrenOf, childViewKind, DATA_STORE_KINDS, defaultErdRelationship, effectiveCategory, entitiesOfStore, ENTITY_CLASSIFICATIONS, ENTITY_STORAGES, ERD_RELATIONSHIP_KINDS, estimateVolume, formatBytes, formatCount, GROWTH_PERIODS, isErdRelationship, isErdStore, LEVEL_BY_VIEW_KIND, makeAttribute, REFRESH_EVERY, REFRESH_MODES, SQL_STORE_KINDS, type ApplicationKind, type Attribute, type Cardinality, type ContainerCategory, type DataStoreKind, type DiagramView, type Element, type EntityClassification, type EntityStorage, type EntityVolume, type ErdRelationshipKind, type GrowthPeriod, type Group, type Project, type RefreshEvery, type RefreshMode, type Relationship, type SqlDialect } from '../core/model'
import { allRelationships, dfdOf, dfdUsage } from '../core/dfd'
import { isDfdView, isStoreItem } from '../core/model'
import { scopeElements } from '../core/views'
import { BoundaryEditor, DfdViewEditor, FlowEditor, GroupEditor, MultiFlows, MultiNodes, NodeEditor, type DfdActions } from './DfdInspector'
import type { Copy } from './i18n'
import { dfdLabel, roleLabel } from './i18n'
import { Icon } from './icons'

export interface InspectorProps {
  project: Project
  view: DiagramView
  selectedIds: Set<string>
  copy: Copy
  groups: Group[]
  /** batchKey folds keystrokes into one undo step until onEndBatch (blur) is called. */
  onPatchElement: (id: string, patch: Partial<Element>, batchKey?: string) => void
  onPatchRelationship: (id: string, patch: Partial<Relationship>, batchKey?: string) => void
  onDeleteElements: (ids: string[]) => void
  onDeleteRelationship: (id: string) => void
  onOpenScope: (kind: DiagramView['kind'], scopeId: string | null) => void
  onPatchView: (patch: Partial<DiagramView>, batchKey?: string) => void
  onCreateGroup: (name: string) => void
  onPatchGroup: (id: string, patch: Partial<Group>, batchKey?: string) => void
  onEndBatch: () => void
  onSetHorizon: (months: number) => void
  onDeleteGroup: (id: string) => void
  onCopyLink: () => void
  onSelect: (id: string) => void
  onOpenView: (viewId: string) => void
  /** Promotes a derived relationship to a stored one (decision: dfd-drives-c4). */
  onMaterialize: (relationship: Relationship) => void
  /** DFD editing; present when the current view is a DFD. */
  dfd?: DfdActions
}

export function Inspector(props: InspectorProps) {
  const { project, view, selectedIds, copy } = props
  const ids = [...selectedIds]
  const dfd = isDfdView(view.kind) && props.dfd ? props.dfd : undefined
  const payload = dfd ? dfdOf(view) : undefined
  const nodes = payload ? ids.map((id) => payload.nodes[id]).filter(Boolean) : []
  const flows = payload ? ids.map((id) => payload.flows[id]).filter(Boolean) : []
  const boundary = payload && ids.length === 1 ? payload.boundaries[ids[0]] : undefined
  const processGroups = payload ? ids.map((id) => payload.groups[id]).filter(Boolean) : []
  const elements = dfd ? [] : ids.map((id) => project.elements[id]).filter(Boolean)
  const relationship = !dfd && ids.length === 1 ? allRelationships(project)[ids[0]] : undefined
  const dfdSelection = nodes.length + flows.length + processGroups.length + (boundary ? 1 : 0)
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
        {!dfd && elements.length === 0 && !relationship && <ViewEditor {...props} />}
        {dfd && payload && nodes.length === 1 && flows.length === 0 && processGroups.length === 0 && <NodeEditor project={project} view={view} payload={payload} node={nodes[0]} copy={copy} actions={dfd} onSelect={props.onSelect} onEndBatch={props.onEndBatch} />}
        {dfd && payload && processGroups.length === 1 && nodes.length === 0 && <GroupEditor project={project} view={view} payload={payload} group={processGroups[0]} copy={copy} actions={dfd} onSelect={props.onSelect} onEndBatch={props.onEndBatch} />}
        {dfd && payload && nodes.length + processGroups.length > 1 && <MultiNodes project={project} nodes={nodes} groups={processGroups} copy={copy} actions={dfd} />}
        {dfd && payload && flows.length === 1 && nodes.length === 0 && <FlowEditor project={project} view={view} payload={payload} flow={flows[0]} copy={copy} actions={dfd} onSelect={props.onSelect} onEndBatch={props.onEndBatch} />}
        {dfd && payload && flows.length > 1 && <MultiFlows project={project} payload={payload} flows={flows} copy={copy} actions={dfd} />}
        {dfd && payload && boundary && <BoundaryEditor project={project} payload={payload} boundary={boundary} copy={copy} actions={dfd} onSelect={props.onSelect} onEndBatch={props.onEndBatch} />}
        {dfd && payload && dfdSelection === 0 && <DfdViewEditor project={project} view={view} payload={payload} copy={copy} actions={dfd} onPatchView={props.onPatchView} onSelect={props.onSelect} onEndBatch={props.onEndBatch} />}
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mb-3 block text-[10px] font-semibold uppercase tracking-wider text-muted">{label}<div className="mt-1 normal-case tracking-normal">{children}</div></label>
}

function ElementEditor({ project, view, element, copy, groups, onPatchElement, onDeleteElements, onOpenScope, onSelect, onEndBatch, onSetHorizon, onOpenView }: InspectorProps & { element: Element }) {
  const kind = childViewKind(element)
  const related = Object.values(allRelationships(project)).filter((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id)
  const usage = dfdUsage(project, element.id)
  const scopeGroups = groups.filter((group) => group.scopeId === (element.parentId ?? null))
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
        <span className="font-semibold">{roleLabel(copy, element)}</span>
        {kind && <button type="button" className="ml-auto flex items-center gap-1 text-cyan hover:underline" onClick={() => onOpenScope(kind, element.id)}><Icon name="external" size={12} />{copy.open}</button>}
      </div>
      <Field label={copy.name}><input className="inspector-input" value={element.name} onChange={(event) => onPatchElement(element.id, { name: event.target.value }, `${element.id}:name`)} onBlur={onEndBatch} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[72px]" value={element.description} onChange={(event) => onPatchElement(element.id, { description: event.target.value }, `${element.id}:description`)} onBlur={onEndBatch} /></Field>
      {element.kind !== 'entity' && !isStoreItem(element) && <Field label={copy.technology}><input className="inspector-input" value={element.technology} onChange={(event) => onPatchElement(element.id, { technology: event.target.value }, `${element.id}:technology`)} onBlur={onEndBatch} /></Field>}
      {element.kind === 'component' && (
        <label className="mb-3 flex cursor-pointer items-start gap-2 text-xs"><input type="checkbox" className="checkbox checkbox-xs mt-0.5" checked={Boolean(element.passthrough)} onChange={(event) => onPatchElement(element.id, { passthrough: event.target.checked || undefined })} /><span>{copy.passthrough}<span className="block text-[10px] leading-4 text-muted">{copy.passthroughHint}</span></span></label>
      )}
      {element.placeholder && <div className="mb-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[11px] leading-4 text-amber">{copy.placeholderHint}</div>}
      {isErdStore(element) && (() => {
        const entities = entitiesOfStore(project, element.id)
        const total = entities.reduce((sum, entity) => sum + (estimateVolume(entity.volume, project.settings.volumeHorizonMonths)?.bytes ?? 0), 0)
        return <Field label={copy.storeTotal}><div className="text-xs">{formatBytes(total)} <span className="text-muted">· {copy.estimateAt(project.settings.volumeHorizonMonths)} · {entities.length} {copy.kinds.entity}</span></div></Field>
      })()}
      {element.kind === 'entity' && (
        <>
          <Field label={copy.classification}>
            <RadioRow name={`classification-${element.id}`} value={element.classification ?? ''} options={[['', copy.noClassification], ...ENTITY_CLASSIFICATIONS.map((option) => [option, copy.classifications[option]] as [string, string])]} onChange={(value) => onPatchElement(element.id, { classification: (value || undefined) as EntityClassification | undefined })} />
          </Field>
          <Field label={copy.storageKind}>
            <RadioRow name={`storage-${element.id}`} value={element.storageKind ?? 'table'} options={ENTITY_STORAGES.map((option) => [option, copy.storages[option]])} onChange={(value) => onPatchElement(element.id, { storageKind: value === 'table' ? undefined : (value as EntityStorage) })} />
          </Field>
          <FieldList element={element} copy={copy} onChange={(attributes, batchKey) => onPatchElement(element.id, { attributes }, batchKey)} onEndBatch={onEndBatch} />
          <VolumeSection element={element} horizon={project.settings.volumeHorizonMonths} copy={copy} onChange={(volume, batchKey) => onPatchElement(element.id, { volume }, batchKey)} onEndBatch={onEndBatch} onSetHorizon={onSetHorizon} />
        </>
      )}
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
      {usage.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.referencedByDfds} · {usage.length}</div>
          {usage.map(({ view: dfdView, node }) => (
            <button key={node.id} type="button" onClick={() => onOpenView(dfdView.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">
              <Icon name="flow" size={12} className="shrink-0" />
              <span className="truncate">{dfdLabel(copy, dfdView)}</span>
              <span className="ml-auto truncate text-[10px] italic">{copy.roles[node.role]}{node.processNumber ? ` ${node.processNumber}` : ''}</span>
            </button>
          ))}
        </div>
      )}
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

function RelationshipEditor({ project, view, relationship, copy, onPatchRelationship, onDeleteRelationship, onSelect, onEndBatch, onOpenView, onMaterialize }: InspectorProps & { relationship: Relationship }) {
  const source = project.elements[relationship.sourceId]
  const target = project.elements[relationship.targetId]
  if (relationship.derived) {
    // A line that exists only because of DFD flows: read-only, with the flows that make it and a way to keep it (decision: dfd-drives-c4).
    return (
      <div>
        <div className="mb-4 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
          <div className="section-label mb-1">{copy.derivedRelationship}</div>
          <button type="button" className="hover:text-cyan" onClick={() => onSelect(relationship.sourceId)}>{source?.name}</button>
          <span className="mx-1 text-muted">→</span>
          <button type="button" className="hover:text-cyan" onClick={() => onSelect(relationship.targetId)}>{target?.name}</button>
        </div>
        <p className="mb-3 text-[10px] leading-4 text-muted">{copy.derivedHint}</p>
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.onThisLine}</div>
          {(relationship.derived.members ?? []).map((member) => {
            const dfdView = project.views[member.viewId]
            const flow = dfdView?.dfd?.flows[member.flowId]
            return <button key={`${member.viewId}-${member.flowId}`} type="button" onClick={() => onOpenView(member.viewId)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content"><Icon name="flow" size={12} className="shrink-0" /><span className="truncate italic">{flow?.label || '—'}</span><span className="ml-auto truncate text-[10px]">{dfdView ? copy.derivedFrom(dfdLabel(copy, dfdView)) : ''}</span></button>
          })}
        </div>
        <button type="button" className="btn btn-primary btn-sm w-full justify-start text-ink" onClick={() => onMaterialize(relationship)}><Icon name="link" size={14} />{copy.materialize}</button>
      </div>
    )
  }
  // Stored relationship: flows that carry it (imported into DFDs) draw on the same line.
  const carryingFlows = Object.values(project.views).flatMap((dfdView) => Object.values(dfdView.dfd?.flows ?? {}).filter((flow) => flow.relationshipRef === relationship.id).map((flow) => ({ dfdView, flow })))
  // Entity-to-entity lines carry the ERD record; an older project may lack it, so default it on the fly.
  const erd = isErdRelationship(project, relationship) ? relationship.erd ?? defaultErdRelationship() : undefined
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
      <Field label={copy.label}><input className="inspector-input" value={relationship.label} onChange={(event) => onPatchRelationship(relationship.id, { label: event.target.value }, `${relationship.id}:label`)} onBlur={onEndBatch} /></Field>
      {erd ? (
        <>
          <Field label={copy.erdKind}>
            <RadioRow name={`erd-kind-${relationship.id}`} value={erd.kind} options={ERD_RELATIONSHIP_KINDS.map((option) => [option, copy.erdKinds[option]])} onChange={(value) => onPatchRelationship(relationship.id, { erd: { ...erd, kind: value as ErdRelationshipKind } })} />
          </Field>
          {erd.kind === 'reference' && (
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" className="checkbox checkbox-xs" checked={Boolean(erd.important)} onChange={(event) => onPatchRelationship(relationship.id, { erd: { ...erd, important: event.target.checked } })} />{copy.showOnCard}</label>
          )}
          {erd.kind !== 'label' && (
            <Field label={copy.multiplicity}>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-muted">
                <span>{source?.name} <span className="opacity-70">({copy.sourceEnd})</span><select className="inspector-input mt-1 py-1" value={erd.sourceCardinality} onChange={(event) => onPatchRelationship(relationship.id, { erd: { ...erd, sourceCardinality: event.target.value as Cardinality } })}>{CARDINALITIES.map((option) => <option key={option} value={option}>{option}</option>)}</select></span>
                <span>{target?.name} <span className="opacity-70">({copy.targetEnd})</span><select className="inspector-input mt-1 py-1" value={erd.targetCardinality} onChange={(event) => onPatchRelationship(relationship.id, { erd: { ...erd, targetCardinality: event.target.value as Cardinality } })}>{CARDINALITIES.map((option) => <option key={option} value={option}>{option}</option>)}</select></span>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-muted">{copy.erdHint}</p>
            </Field>
          )}
        </>
      ) : (
        <Field label={copy.technology}><input className="inspector-input" value={relationship.technology ?? ''} onChange={(event) => onPatchRelationship(relationship.id, { technology: event.target.value }, `${relationship.id}:technology`)} onBlur={onEndBatch} /></Field>
      )}
      <Field label={copy.description}><textarea className="inspector-input min-h-[60px]" value={relationship.description ?? ''} onChange={(event) => onPatchRelationship(relationship.id, { description: event.target.value }, `${relationship.id}:description`)} onBlur={onEndBatch} /></Field>
      {carryingFlows.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.onThisLine}</div>
          {carryingFlows.map(({ dfdView, flow }) => <button key={flow.id} type="button" onClick={() => onOpenView(dfdView.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content"><Icon name="flow" size={12} className="shrink-0" /><span className="truncate italic">{flow.label || '—'}</span><span className="ml-auto truncate text-[10px]">{dfdLabel(copy, dfdView)}</span></button>)}
        </div>
      )}
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

function ViewEditor({ project, view, copy, groups, onPatchView, onCreateGroup, onPatchGroup, onDeleteGroup, onEndBatch }: InspectorProps) {
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
      <Field label={copy.viewName}><input className="inspector-input" value={view.name} onChange={(event) => onPatchView({ name: event.target.value }, `${view.id}:name`)} onBlur={onEndBatch} placeholder={copy.defaultView} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[56px]" value={view.description} onChange={(event) => onPatchView({ description: event.target.value }, `${view.id}:description`)} onBlur={onEndBatch} /></Field>
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
          <input className="inspector-input py-1 text-xs" value={group.name} onChange={(event) => onPatchGroup(group.id, { name: event.target.value }, `${group.id}:name`)} onBlur={onEndBatch} />
          <input type="color" className="h-7 w-7 cursor-pointer rounded border border-line bg-transparent" value={group.color ?? '#9ca3af'} onChange={(event) => onPatchGroup(group.id, { color: event.target.value })} title={copy.group} />
          <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-rose-500/10 hover:text-rose-400" onClick={() => onDeleteGroup(group.id)} title={copy.deleteGroup}><Icon name="trash" size={13} /></button>
        </div>
      ))}
    </div>
  )
}

/**
 * Entity field list: every attribute with its flags, quick entry that keeps focus (flow: erd-authoring),
 * and an important-only filter. The canvas draws only the important rows (decision: important-fields-on-canvas).
 */
function FieldList({ element, copy, onChange, onEndBatch }: { element: Element; copy: Copy; onChange: (attributes: Attribute[], batchKey?: string) => void; onEndBatch: () => void }) {
  const attributes = element.attributes ?? []
  const [name, setName] = useState('')
  const [importantOnly, setImportantOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  useEffect(() => { setOpenId(null) }, [element.id])
  const update = (id: string, patch: Partial<Attribute>, batchKey?: string) => onChange(attributes.map((attribute) => (attribute.id === id ? { ...attribute, ...patch } : attribute)), batchKey)
  const remove = (id: string) => onChange(attributes.filter((attribute) => attribute.id !== id))
  const move = (id: string, delta: -1 | 1) => {
    const next = [...attributes]
    const index = next.findIndex((attribute) => attribute.id === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onChange([...attributes, makeAttribute(trimmed)])
    setName('')
    inputRef.current?.focus()
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing) { event.preventDefault(); add() }
  }
  const shown = importantOnly ? attributes.filter((attribute) => attribute.important) : attributes
  const flag = (id: string, key: 'important' | 'primaryKey' | 'required' | 'unique', value: boolean, label: string, title: string) => (
    <button type="button" title={title} onClick={() => update(id, key === 'primaryKey' && !value ? { primaryKey: true, important: true, required: true, unique: true } : { [key]: !value })} className={`rounded px-1 text-[9px] font-bold leading-4 ${value ? (key === 'important' ? 'bg-amber/25 text-amber' : 'bg-cyan/15 text-cyan') : 'text-muted/60 hover:text-muted'}`}>{label}</button>
  )
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.fields} · {attributes.filter((attribute) => attribute.important).length}/{attributes.length}</div>
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-muted"><input type="checkbox" className="checkbox checkbox-xs" checked={importantOnly} onChange={(event) => setImportantOnly(event.target.checked)} />{copy.importantOnly}</label>
      </div>
      <div className="rounded-lg border border-line bg-ink/40">
        {shown.map((attribute, index) => (
          <div key={attribute.id} className={`border-b border-line/60 px-2 py-1 last:border-b-0 ${attribute.important ? '' : 'opacity-75'}`}>
            <div className="flex items-center gap-1">
              <input type="checkbox" className="checkbox checkbox-xs" checked={attribute.important} title={copy.important} onChange={(event) => update(attribute.id, { important: event.target.checked })} />
              {attribute.primaryKey && <Icon name="key" size={11} className="shrink-0 text-cyan" />}
              <input className="min-w-0 flex-1 bg-transparent text-xs text-base-content outline-none" value={attribute.name} onChange={(event) => update(attribute.id, { name: event.target.value }, `${attribute.id}:name`)} onBlur={onEndBatch} onFocus={() => setOpenId(attribute.id)} />
              {flag(attribute.id, 'primaryKey', attribute.primaryKey, copy.primaryKey, copy.primaryKey)}
              {flag(attribute.id, 'required', attribute.required, '!', copy.required)}
              {flag(attribute.id, 'unique', attribute.unique, 'U', copy.unique)}
              <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 hover:text-base-content" onClick={() => setOpenId(openId === attribute.id ? null : attribute.id)} title={copy.fieldDescription}><Icon name={openId === attribute.id ? 'chevronDown' : 'chevron'} size={11} /></button>
            </div>
            {openId === attribute.id && (
              <div className="mt-1 flex items-start gap-1 pl-5">
                <textarea className="inspector-input min-h-[40px] flex-1 py-1 text-xs" placeholder={copy.fieldDescription} value={attribute.description} onChange={(event) => update(attribute.id, { description: event.target.value }, `${attribute.id}:description`)} onBlur={onEndBatch} />
                <div className="flex flex-col gap-0.5">
                  <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 disabled:opacity-30" title={copy.moveUp} disabled={index === 0 || importantOnly} onClick={() => move(attribute.id, -1)}><Icon name="arrowUp" size={11} /></button>
                  <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 disabled:opacity-30" title={copy.moveDown} disabled={index === shown.length - 1 || importantOnly} onClick={() => move(attribute.id, 1)}><Icon name="arrowDown" size={11} /></button>
                  <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-rose-500/10 hover:text-rose-400" title={copy.deleteField} onClick={() => remove(attribute.id)}><Icon name="trash" size={11} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="px-2 py-1">
          <input
            ref={inputRef}
            className="w-full bg-transparent text-xs text-base-content outline-none placeholder:text-muted/60"
            placeholder={copy.addField}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={onKey}
            onCompositionStart={() => { composing.current = true }}
            onCompositionEnd={() => { composing.current = false }}
          />
        </div>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-muted">{copy.addFieldHint}</p>
    </div>
  )
}

/** Volume assumptions and the derived estimate (requirement: data-volume-estimation). Numbers commit per keystroke in one undo batch. */
function VolumeSection({ element, horizon, copy, onChange, onEndBatch, onSetHorizon }: { element: Element; horizon: number; copy: Copy; onChange: (volume: EntityVolume, batchKey?: string) => void; onEndBatch: () => void; onSetHorizon: (months: number) => void }) {
  const volume = element.volume ?? {}
  const estimate = estimateVolume(volume, horizon)
  const number = (key: keyof EntityVolume, label: string) => (
    <label className="block text-[10px] text-muted">{label}
      <input type="number" min="0" className="inspector-input mt-0.5 py-1 text-xs" value={volume[key] ?? ''} onChange={(event) => onChange({ ...volume, [key]: event.target.value === '' ? undefined : Number(event.target.value) }, `${element.id}:volume:${key}`)} onBlur={onEndBatch} />
    </label>
  )
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.volume}</div>
      <div className="grid grid-cols-2 gap-2">
        {number('recordBytes', copy.recordBytes)}
        {number('initialRows', copy.initialRows)}
        {number('growthRows', copy.growthRows)}
        <label className="block text-[10px] text-muted">{copy.per}
          <select className="inspector-input mt-0.5 py-1 text-xs" value={volume.growthPeriod ?? 'day'} onChange={(event) => onChange({ ...volume, growthPeriod: event.target.value as GrowthPeriod })}>{GROWTH_PERIODS.map((option) => <option key={option} value={option}>{copy.growthPeriods[option]}</option>)}</select>
        </label>
        <label className="block text-[10px] text-muted">{copy.refreshMode}
          <select className="inspector-input mt-0.5 py-1 text-xs" value={volume.refreshMode ?? 'append'} onChange={(event) => onChange({ ...volume, refreshMode: event.target.value as RefreshMode })}>{REFRESH_MODES.map((option) => <option key={option} value={option}>{copy.refreshModes[option]}</option>)}</select>
        </label>
        <label className="block text-[10px] text-muted">{copy.refreshEvery}
          <select className="inspector-input mt-0.5 py-1 text-xs" value={volume.refreshEvery ?? 'daily'} onChange={(event) => onChange({ ...volume, refreshEvery: event.target.value as RefreshEvery })}>{REFRESH_EVERY.map((option) => <option key={option} value={option}>{copy.refreshEveries[option]}</option>)}</select>
        </label>
        <div className="col-span-2">{number('retentionMonths', copy.retentionMonths)}</div>
        <label className="col-span-2 block text-[10px] text-muted">{copy.horizon}
          <input type="number" min="1" className="inspector-input mt-0.5 py-1 text-xs" value={horizon} onChange={(event) => onSetHorizon(Math.max(1, Number(event.target.value) || 1))} />
        </label>
      </div>
      <div className="mt-2 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
        <div className="text-[10px] uppercase tracking-wider text-muted">{copy.estimateAt(horizon)}</div>
        {estimate ? (
          <>
            <div className="mt-0.5 text-sm font-semibold">{formatBytes(estimate.bytes)} <span className="text-xs font-normal text-muted">· {formatCount(estimate.rows)} {copy.rowsLabel}</span></div>
            <div className="text-[10px] text-muted">{formatCount(estimate.dailyWriteRows)} {copy.dailyWrites} · {copy.excludesIndexes}</div>
          </>
        ) : <div className="mt-0.5 text-[10px] text-muted">{copy.noEstimate}</div>}
      </div>
    </div>
  )
}

import { useRef, useState, type KeyboardEvent } from 'react'
import { bindCandidatesFor, dfdViews, groupChain, groupName, groupOf, importableLinks, nodeElement, nodeName, placementOptionsFor, processNumbers, representativeOf, touchesStore, type ImportableLink, type PlacementOption } from '../core/dfd'
import { CRUD_OPERATIONS, INTERMEDIATE_KINDS, type Consistency, type CrudOperation, type DfdBoundary, type DfdFlow, type DfdGroup, type DfdNode, type DfdPayload, type DfdRole, type DiagramView, type IntermediateKind, type Project } from '../core/model'
import { dfdLabel, roleLabel, type Copy } from './i18n'
import { Icon } from './icons'
import { Field, RadioRow } from './Inspector'
import { TermChips } from './VocabularyBits'

/** Everything the DFD editors can do; App implements it over the pure commands. */
export interface DfdActions {
  patchNode: (nodeId: string, patch: Partial<DfdNode>, batchKey?: string) => void
  deleteNodes: (nodeIds: string[]) => void
  placeNode: (nodeId: string, option: PlacementOption) => void
  bindNode: (nodeId: string, elementId: string) => void
  unbindNode: (nodeId: string) => void
  zoomProcess: (nodeId: string) => void
  openElement: (elementId: string) => void
  patchFlow: (flowId: string, patch: Partial<DfdFlow>, batchKey?: string) => void
  deleteFlow: (flowId: string) => void
  createBoundary: (flowIds: string[]) => void
  patchBoundary: (boundaryId: string, patch: Partial<DfdBoundary>, batchKey?: string) => void
  deleteBoundary: (boundaryId: string) => void
  importLink: (link: ImportableLink) => void
  importAllLinks: () => void
  addDiagramRef: (targetViewId: string) => void
  openView: (viewId: string) => void
  /** Opens a vocabulary entry mentioned in a flow label. */
  openEntry: (entryId: string) => void
  groupMembers: (memberIds: string[]) => void
  patchGroup: (groupId: string, patch: Partial<DfdGroup>, batchKey?: string) => void
  ungroup: (groupId: string) => void
  removeFromGroup: (memberId: string) => void
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void
}

/** Breadcrumb of the logical process groups a member sits in, innermost last. */
function GroupTrail({ project, payload, memberId, copy, onSelect, actions }: { project: Project; payload: DfdPayload; memberId: string; copy: Copy; onSelect: (id: string) => void; actions: DfdActions }) {
  const chain = groupChain(payload, memberId)
  if (!chain.length) return null
  const numbers = processNumbers(payload)
  return (
    <Field label={copy.inGroup}>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {chain.map((id, index) => (
          <span key={id} className="flex items-center gap-1">
            {index > 0 && <Icon name="chevron" size={10} className="text-muted" />}
            <button type="button" className="rounded bg-cyan/10 px-1.5 py-0.5 text-cyan hover:underline" onClick={() => onSelect(id)}>{numbers[id]} {groupName(project, payload, payload.groups[id])}</button>
          </span>
        ))}
        <button type="button" className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-base-content" onClick={() => actions.removeFromGroup(memberId)}><Icon name="unlink" size={11} />{copy.removeFromGroup}</button>
      </div>
    </Field>
  )
}

const FREE_ROLES: DfdRole[] = ['process', 'data_store', 'external_entity', 'intermediate_data']

function placementLabel(copy: Copy, project: Project, option: PlacementOption) {
  const kind = option.patch.passthrough ? copy.passthrough.split(' (')[0] : copy.kinds[option.kind]
  if (option.newContainer) {
    if (option.newContainer.placeholder) return `${kind} · ${copy.placeholderContainer}`
    const containerKind = option.newContainer.containerCategory === 'dataStore' ? copy.dataStoreKinds[option.newContainer.dataStoreKind ?? 'other'] : copy.applicationKinds[option.newContainer.applicationKind ?? 'other']
    return `${kind} · ${copy.newContainerFor(containerKind)}`
  }
  const parent = option.parentId ? project.elements[option.parentId]?.name : undefined
  return parent ? `${kind} · ${parent}` : `${kind} · ${copy.projectRoot}`
}

/** Stored 1:1 component links between present nodes that no flow carries yet (requirement: c4-links-into-dfd). */
function ImportList({ project, view, links, copy, actions }: { project: Project; view: DiagramView; links: ImportableLink[]; copy: Copy; actions: DfdActions }) {
  if (!links.length) return null
  const payload = view.dfd!
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.importLinks} · {links.length}</div>
        {links.length > 1 && <button type="button" className="text-[11px] text-cyan hover:underline" onClick={actions.importAllLinks}>{copy.importAll}</button>}
      </div>
      {links.map((link) => (
        <div key={`${link.relationship.id}-${link.targetNodeId}`} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted">
          <span className="min-w-0 flex-1 truncate">{nodeName(project, payload.nodes[link.sourceNodeId])} → {link.viaElementId ? `${project.elements[link.viaElementId]?.name} → ` : ''}{nodeName(project, payload.nodes[link.targetNodeId])}<span className="italic"> · {link.relationship.label}</span></span>
          <button type="button" className="btn btn-ghost btn-xs shrink-0 border border-line" onClick={() => actions.importLink(link)}>{copy.importLink}</button>
        </div>
      ))}
    </div>
  )
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="btn btn-ghost btn-sm mt-4 w-full justify-start text-rose-400 hover:bg-rose-500/10" onClick={onClick}><Icon name="trash" size={14} />{label}</button>
}

function FlowRow({ project, payload, flow, nodeId, onSelect }: { project: Project; payload: DfdPayload; flow: DfdFlow; nodeId?: string; onSelect: (id: string) => void }) {
  const outgoing = flow.sourceNodeId === nodeId
  const other = payload.nodes[nodeId ? (outgoing ? flow.targetNodeId : flow.sourceNodeId) : flow.targetNodeId]
  const source = payload.nodes[flow.sourceNodeId]
  return (
    <button type="button" onClick={() => onSelect(flow.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">
      <span className="text-[10px]">{nodeId ? (outgoing ? '→' : '←') : '•'}</span>
      <span className="truncate">{nodeId ? (other ? nodeName(project, other) : '?') : `${source ? nodeName(project, source) : '?'} → ${other ? nodeName(project, other) : '?'}`}</span>
      <span className="ml-auto truncate text-[10px] italic">{flow.label}</span>
    </button>
  )
}

/** One DFD node: bound nodes show their element and where it zooms; free nodes edit their own text and offer placement. */
export function NodeEditor({ project, view, payload, node, copy, actions, onSelect, onEndBatch }: { project: Project; view: DiagramView; payload: DfdPayload; node: DfdNode; copy: Copy; actions: DfdActions; onSelect: (id: string) => void; onEndBatch: () => void }) {
  const element = nodeElement(project, node)
  const options = element ? [] : placementOptionsFor(project, view, node)
  const candidates = element ? [] : bindCandidatesFor(project, view, node)
  const [placement, setPlacement] = useState(options[0]?.id ?? '')
  const [candidate, setCandidate] = useState('')
  const flows = Object.values(payload.flows).filter((flow) => flow.sourceNodeId === node.id || flow.targetNodeId === node.id)
  const targets = dfdViews(project).filter((candidateView) => candidateView.id !== view.id)
  const chosen = options.find((option) => option.id === placement) ?? options[0]
  const links = importableLinks(project, view).filter((link) => link.sourceNodeId === node.id || link.targetNodeId === node.id)
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
        <span className="font-semibold">{node.role === 'intermediate_data' ? copy.intermediateKinds[node.intermediateKind ?? 'file'] : copy.roles[node.role]}</span>
        {node.processNumber && <span className="rounded bg-cyan/15 px-1.5 text-[10px] font-bold text-cyan">{node.processNumber}</span>}
        {element && <button type="button" className="ml-auto flex items-center gap-1 text-cyan hover:underline" onClick={() => actions.openElement(element.id)}><Icon name="external" size={12} />{copy.openElement}</button>}
      </div>
      {node.role === 'start' ? (
        <Field label={copy.description}><div className="text-xs text-muted">{copy.startLegend}</div></Field>
      ) : element ? (
        <>
          <Field label={copy.boundElement}><div className="text-xs"><span className="font-semibold">{element.name}</span> <span className="text-muted">· {roleLabel(copy, element)}{element.parentId ? ` · ${project.elements[element.parentId]?.name ?? ''}` : ''}</span></div></Field>
          {element.description && <Field label={copy.description}><div className="text-xs text-muted">{element.description}</div></Field>}
          <button type="button" className="mb-3 flex items-center gap-1 text-[11px] text-muted hover:text-base-content" onClick={() => actions.unbindNode(node.id)}><Icon name="unlink" size={12} />{copy.unbind}</button>
        </>
      ) : node.role === 'diagram_ref' ? (
        <>
          <Field label={copy.label}><input className="inspector-input" value={node.name} onChange={(event) => actions.patchNode(node.id, { name: event.target.value }, `${node.id}:name`)} onBlur={onEndBatch} /></Field>
          <Field label={copy.refTarget}>
            <select className="inspector-input" value={node.targetViewId ?? ''} onChange={(event) => actions.patchNode(node.id, { targetViewId: event.target.value || undefined })}>
              <option value="">{copy.noTarget}</option>
              {targets.map((target) => <option key={target.id} value={target.id}>{dfdLabel(copy, target)} · {copy.viewKinds[target.kind]}</option>)}
            </select>
          </Field>
          {node.targetViewId && project.views[node.targetViewId] && <button type="button" className="btn btn-ghost btn-sm mb-3 w-full justify-start text-cyan hover:bg-cyan/10" onClick={() => actions.openView(node.targetViewId!)}><Icon name="external" size={14} />{copy.open}</button>}
        </>
      ) : (
        <>
          <div className="mb-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[11px] leading-4 text-amber">{copy.freeNode}. {copy.freeNodeHint}</div>
          <Field label={copy.name}><input className="inspector-input" value={node.name} onChange={(event) => actions.patchNode(node.id, { name: event.target.value }, `${node.id}:name`)} onBlur={onEndBatch} /></Field>
          <Field label={copy.description}><textarea className="inspector-input min-h-[56px]" value={node.description} onChange={(event) => actions.patchNode(node.id, { description: event.target.value }, `${node.id}:description`)} onBlur={onEndBatch} /></Field>
          <Field label={copy.technology}><input className="inspector-input" value={node.technology} onChange={(event) => actions.patchNode(node.id, { technology: event.target.value }, `${node.id}:technology`)} onBlur={onEndBatch} /></Field>
          <Field label={copy.role}>
            <RadioRow name={`role-${node.id}`} value={node.role} options={FREE_ROLES.map((role) => [role, copy.roles[role]])} onChange={(value) => actions.patchNode(node.id, { role: value as DfdRole })} />
            {node.role === 'intermediate_data' && <div className="mt-1"><RadioRow name={`intermediate-${node.id}`} value={node.intermediateKind ?? 'api_document'} options={INTERMEDIATE_KINDS.map((kind) => [kind, copy.intermediateKinds[kind]])} onChange={(value) => actions.patchNode(node.id, { intermediateKind: value as IntermediateKind })} /></div>}
          </Field>
          {options.length > 0 && (
            <Field label={copy.placeInModel}>
              <div className="flex gap-1">
                <select className="inspector-input py-1" value={chosen?.id ?? ''} onChange={(event) => setPlacement(event.target.value)}>
                  {options.map((option) => <option key={option.id} value={option.id}>{placementLabel(copy, project, option)}</option>)}
                </select>
                <button type="button" className="btn btn-primary btn-xs shrink-0 text-ink" disabled={!chosen} onClick={() => chosen && actions.placeNode(node.id, chosen)}>{copy.place}</button>
              </div>
            </Field>
          )}
          {candidates.length > 0 && (
            <Field label={copy.bindToExisting}>
              <div className="flex gap-1">
                <select className="inspector-input py-1" value={candidate} onChange={(event) => setCandidate(event.target.value)}>
                  <option value="">—</option>
                  {candidates.map((item) => <option key={item.id} value={item.id}>{item.name}{item.parentId ? ` · ${project.elements[item.parentId]?.name ?? ''}` : ''}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-xs shrink-0 border border-line" disabled={!candidate} onClick={() => candidate && actions.bindNode(node.id, candidate)}>{copy.bind}</button>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-muted">{copy.bindHint}</p>
            </Field>
          )}
        </>
      )}
      <GroupTrail project={project} payload={payload} memberId={node.id} copy={copy} onSelect={onSelect} actions={actions} />
      <ImportList project={project} view={view} links={links} copy={copy} actions={actions} />
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.dfdFlow} · {flows.length}</div>
        {flows.map((flow) => <FlowRow key={flow.id} project={project} payload={payload} flow={flow} nodeId={node.id} onSelect={onSelect} />)}
        <p className="mt-1 text-[10px] text-muted">{copy.connectHint}</p>
      </div>
      {node.role !== 'start' && <DeleteButton label={copy.deleteNode} onClick={() => actions.deleteNodes([node.id])} />}
    </div>
  )
}

export function MultiNodes({ project, nodes, groups, copy, actions }: { project: Project; nodes: DfdNode[]; groups: DfdGroup[]; copy: Copy; actions: DfdActions }) {
  const groupable = [...nodes.filter((node) => node.role === 'process' || node.role === 'intermediate_data').map((node) => node.id), ...groups.map((group) => group.id)]
  const units = nodes.filter((node) => node.role === 'process').length + groups.length
  return (
    <div>
      <div className="mb-3 text-xs text-muted">{nodes.length + groups.length} × {copy.dfdNode}</div>
      <ul className="mb-4 space-y-1 text-xs">{nodes.map((node) => <li key={node.id} className="truncate">{nodeName(project, node)}</li>)}{groups.map((group) => <li key={group.id} className="truncate italic">{group.processNumber} {group.name || copy.processGroup}</li>)}</ul>
      {units >= 2 && <button type="button" className="btn btn-primary btn-sm mb-2 w-full justify-start text-ink" onClick={() => actions.groupMembers(groupable)}><Icon name="layers" size={14} />{copy.groupSelected}</button>}
      {nodes.length > 0 && <DeleteButton label={copy.deleteNode} onClick={() => actions.deleteNodes(nodes.map((node) => node.id))} />}
    </div>
  )
}

/** A logical process group: representative, name override, members, collapse, and dissolve (decision: dfd-logical-process-group). */
export function GroupEditor({ project, view, payload, group, copy, actions, onSelect, onEndBatch }: { project: Project; view: DiagramView; payload: DfdPayload; group: DfdGroup; copy: Copy; actions: DfdActions; onSelect: (id: string) => void; onEndBatch: () => void }) {
  const representative = representativeOf(project, payload, group)
  const numbers = processNumbers(payload)
  const collapsed = (view.layout.collapsedGroupIds ?? []).includes(group.id)
  const parent = groupOf(payload, group.id)
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
        <span className="font-semibold">{copy.processGroup}</span>
        <span className="rounded bg-cyan/15 px-1.5 text-[10px] font-bold text-cyan">{numbers[group.id] ?? group.processNumber}</span>
        <button type="button" className="ml-auto flex items-center gap-1 text-cyan hover:underline" onClick={() => actions.setGroupCollapsed(group.id, !collapsed)}><Icon name={collapsed ? 'expand' : 'shrink'} size={12} />{collapsed ? copy.expand : copy.collapse}</button>
      </div>
      <p className="mb-3 text-[10px] leading-4 text-muted">{copy.processGroupHint}</p>
      <Field label={copy.groupNameOverride}><input className="inspector-input" value={group.name} placeholder={representative ? nodeName(project, representative) : ''} onChange={(event) => actions.patchGroup(group.id, { name: event.target.value }, `${group.id}:name`)} onBlur={onEndBatch} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[56px]" value={group.description} onChange={(event) => actions.patchGroup(group.id, { description: event.target.value }, `${group.id}:description`)} onBlur={onEndBatch} /></Field>
      {representative && <Field label={copy.representative}><button type="button" className="text-xs hover:text-cyan" onClick={() => onSelect(representative.id)}>{nodeName(project, representative)}</button></Field>}
      {parent && <GroupTrail project={project} payload={payload} memberId={group.id} copy={copy} onSelect={onSelect} actions={actions} />}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.members} · {group.memberIds.length}</div>
        {group.memberIds.map((id) => {
          const member = payload.nodes[id]
          const child = payload.groups[id]
          const label = member ? nodeName(project, member) : child ? `${numbers[id] ?? child.processNumber} ${groupName(project, payload, child)}` : id
          return (
            <div key={id} className="flex items-center gap-1">
              <button type="button" onClick={() => onSelect(id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">
                {member?.role === 'process' || child ? <span className="w-8 shrink-0 text-[10px] font-bold text-cyan">{numbers[id] ?? ''}</span> : <span className="w-8 shrink-0 text-[10px]">→</span>}
                <span className="truncate">{label}</span>
                {member && <span className="ml-auto truncate text-[10px] italic">{member.role === 'intermediate_data' ? copy.intermediateKinds[member.intermediateKind ?? 'api_document'] : copy.roles[member.role]}</span>}
              </button>
              <button type="button" className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-white/10 hover:text-base-content" title={copy.removeFromGroup} onClick={() => actions.removeFromGroup(id)}><Icon name="unlink" size={11} /></button>
            </div>
          )
        })}
      </div>
      <DeleteButton label={copy.ungroup} onClick={() => actions.ungroup(group.id)} />
    </div>
  )
}

/** One flow: label, the data it carries, CRUD at the store end, boundary membership, and the C4 consistency offer. */
export function FlowEditor({ project, view, payload, flow, copy, actions, onSelect, onEndBatch }: { project: Project; view: DiagramView; payload: DfdPayload; flow: DfdFlow; copy: Copy; actions: DfdActions; onSelect: (id: string) => void; onEndBatch: () => void }) {
  const source = payload.nodes[flow.sourceNodeId]
  const target = payload.nodes[flow.targetNodeId]
  const [ref, setRef] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const entities = Object.values(project.elements).filter((element) => element.kind === 'entity').sort((a, b) => a.name.localeCompare(b.name))
  const addRef = () => {
    const trimmed = ref.trim()
    if (!trimmed) return
    const match = entities.find((entity) => entity.name.toLowerCase() === trimmed.toLowerCase())
    const value = match?.id ?? trimmed
    if (!flow.dataRefs.includes(value)) actions.patchFlow(flow.id, { dataRefs: [...flow.dataRefs, value] })
    setRef('')
    inputRef.current?.focus()
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing) { event.preventDefault(); addRef() } }
  const toggleOperation = (operation: CrudOperation) => actions.patchFlow(flow.id, { operations: flow.operations.includes(operation) ? flow.operations.filter((item) => item !== operation) : CRUD_OPERATIONS.filter((item) => item === operation || flow.operations.includes(item)) })
  const boundaries = Object.values(payload.boundaries)
  const toggleBoundary = (boundary: DfdBoundary) => actions.patchBoundary(boundary.id, { flowIds: boundary.flowIds.includes(flow.id) ? boundary.flowIds.filter((id) => id !== flow.id) : [...boundary.flowIds, flow.id] })
  const sameLine = Object.values(payload.flows).filter((other) => other.id !== flow.id && other.sourceNodeId === flow.sourceNodeId && other.targetNodeId === flow.targetNodeId)
  const carried = flow.relationshipRef ? project.relationships[flow.relationshipRef] : undefined
  void view
  return (
    <div>
      <div className="mb-4 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs">
        <div className="section-label mb-1">{copy.dfdFlow}</div>
        <button type="button" className="hover:text-cyan" onClick={() => source && onSelect(source.id)}>{source ? nodeName(project, source) : '?'}</button>
        <span className="mx-1 text-muted">→</span>
        <button type="button" className="hover:text-cyan" onClick={() => target && onSelect(target.id)}>{target ? nodeName(project, target) : '?'}</button>
      </div>
      <Field label={copy.label}><input className="inspector-input" value={flow.label} onChange={(event) => actions.patchFlow(flow.id, { label: event.target.value }, `${flow.id}:label`)} onBlur={onEndBatch} /></Field>
      <TermChips project={project} texts={[flow.label, flow.description]} copy={copy} onOpenEntry={actions.openEntry} />
      <Field label={copy.dataRefs}>
        <div className="mb-1 flex flex-wrap gap-1">
          {flow.dataRefs.map((item) => (
            <span key={item} className="flex items-center gap-1 rounded-md border border-line bg-ink/40 px-1.5 py-0.5 text-[11px]">
              {project.elements[item] ? <Icon name="table" size={10} className="text-cyan" /> : null}{project.elements[item]?.name ?? item}
              <button type="button" className="text-muted hover:text-rose-400" onClick={() => actions.patchFlow(flow.id, { dataRefs: flow.dataRefs.filter((other) => other !== item) })} aria-label={copy.cancel}><Icon name="x" size={10} /></button>
            </span>
          ))}
        </div>
        <input ref={inputRef} className="inspector-input py-1 text-xs" list={`entities-${flow.id}`} placeholder={copy.addDataRef} value={ref} onChange={(event) => setRef(event.target.value)} onKeyDown={onKey} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} />
        <datalist id={`entities-${flow.id}`}>{entities.map((entity) => <option key={entity.id} value={entity.name} />)}</datalist>
        <p className="mt-1 text-[10px] leading-4 text-muted">{copy.dataRefsHint}</p>
      </Field>
      {touchesStore(payload, flow) && (
        <Field label={copy.operationsLabel}>
          <div className="flex gap-1">
            {CRUD_OPERATIONS.map((operation) => (
              <button key={operation} type="button" title={copy.operations[operation]} onClick={() => toggleOperation(operation)} className={`rounded-md border px-2 py-1 text-[11px] font-bold ${flow.operations.includes(operation) ? 'border-cyan bg-cyan/15 text-cyan' : 'border-line text-muted hover:border-muted hover:text-base-content'}`}>{operation}</button>
            ))}
          </div>
        </Field>
      )}
      <Field label={copy.technology}><input className="inspector-input" value={flow.technology} onChange={(event) => actions.patchFlow(flow.id, { technology: event.target.value }, `${flow.id}:technology`)} onBlur={onEndBatch} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[56px]" value={flow.description} onChange={(event) => actions.patchFlow(flow.id, { description: event.target.value }, `${flow.id}:description`)} onBlur={onEndBatch} /></Field>
      {boundaries.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.inBoundary}</div>
          {boundaries.map((boundary) => (
            <label key={boundary.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-white/5">
              <input type="checkbox" className="checkbox checkbox-xs" checked={boundary.flowIds.includes(flow.id)} onChange={() => toggleBoundary(boundary)} />
              <span className="truncate">{boundary.name}</span>
              <span className="ml-auto text-[10px] text-muted">{copy.consistencies[boundary.consistency]}</span>
            </label>
          ))}
        </div>
      )}
      {carried && <Field label={copy.relationship}><div className="text-xs text-muted">{project.elements[carried.sourceId]?.name} → {project.elements[carried.targetId]?.name} · <span className="italic">{carried.label}</span></div></Field>}
      {sameLine.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.onThisLine}</div>
          {sameLine.map((other) => <button key={other.id} type="button" onClick={() => onSelect(other.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content"><span className="truncate italic">{other.label || '—'}</span>{other.technology && <span className="ml-auto text-[10px]">[{other.technology}]</span>}</button>)}
        </div>
      )}
      <DeleteButton label={copy.deleteFlow} onClick={() => actions.deleteFlow(flow.id)} />
    </div>
  )
}

export function MultiFlows({ project, payload, flows, copy, actions }: { project: Project; payload: DfdPayload; flows: DfdFlow[]; copy: Copy; actions: DfdActions }) {
  return (
    <div>
      <div className="mb-3 text-xs text-muted">{flows.length} × {copy.dfdFlow}</div>
      <ul className="mb-4 space-y-1 text-xs">{flows.map((flow) => <li key={flow.id} className="truncate">{nodeName(project, payload.nodes[flow.sourceNodeId])} → {nodeName(project, payload.nodes[flow.targetNodeId])}{flow.label ? ` · ${flow.label}` : ''}</li>)}</ul>
      <button type="button" className="btn btn-primary btn-sm w-full justify-start text-ink" onClick={() => actions.createBoundary(flows.map((flow) => flow.id))}><Icon name="group" size={14} />{copy.newBoundary}</button>
    </div>
  )
}

export function BoundaryEditor({ project, payload, boundary, copy, actions, onSelect, onEndBatch }: { project: Project; payload: DfdPayload; boundary: DfdBoundary; copy: Copy; actions: DfdActions; onSelect: (id: string) => void; onEndBatch: () => void }) {
  const members = boundary.flowIds.map((id) => payload.flows[id]).filter(Boolean)
  return (
    <div>
      <div className="mb-4 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs"><div className="section-label">{copy.dfdBoundary}</div></div>
      <Field label={copy.name}><input className="inspector-input" value={boundary.name} onChange={(event) => actions.patchBoundary(boundary.id, { name: event.target.value }, `${boundary.id}:name`)} onBlur={onEndBatch} /></Field>
      <Field label={copy.consistency}>
        <RadioRow name={`consistency-${boundary.id}`} value={boundary.consistency} options={(['atomic', 'eventual'] as Consistency[]).map((option) => [option, copy.consistencies[option]])} onChange={(value) => actions.patchBoundary(boundary.id, { consistency: value as Consistency })} />
      </Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[56px]" value={boundary.description} onChange={(event) => actions.patchBoundary(boundary.id, { description: event.target.value }, `${boundary.id}:description`)} onBlur={onEndBatch} /></Field>
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.memberFlows} · {members.length}</div>
        {members.map((flow) => (
          <div key={flow.id} className="flex items-center gap-1">
            <div className="min-w-0 flex-1"><FlowRow project={project} payload={payload} flow={flow} onSelect={onSelect} /></div>
            <button type="button" className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-rose-500/10 hover:text-rose-400" onClick={() => actions.patchBoundary(boundary.id, { flowIds: boundary.flowIds.filter((id) => id !== flow.id) })} aria-label={copy.cancel}><Icon name="x" size={11} /></button>
          </div>
        ))}
        <p className="mt-1 text-[10px] leading-4 text-muted">{copy.newBoundaryHint}</p>
      </div>
      <DeleteButton label={copy.deleteBoundary} onClick={() => actions.deleteBoundary(boundary.id)} />
    </div>
  )
}

/** Nothing selected in a DFD: name, use case, description, off-page references, and the boundary list. */
export function DfdViewEditor({ project, view, payload, copy, actions, onPatchView, onSelect, onEndBatch }: { project: Project; view: DiagramView; payload: DfdPayload; copy: Copy; actions: DfdActions; onPatchView: (patch: Partial<DiagramView>, batchKey?: string) => void; onSelect: (id: string) => void; onEndBatch: () => void }) {
  const [target, setTarget] = useState('')
  const targets = dfdViews(project).filter((candidate) => candidate.id !== view.id)
  const boundaries = Object.values(payload.boundaries)
  const links = importableLinks(project, view)
  return (
    <div>
      <div className="mb-3 text-xs text-muted">{copy.selectHint} {copy.dropHint}.</div>
      <ImportList project={project} view={view} links={links} copy={copy} actions={actions} />
      <Field label={copy.useCase}><input className="inspector-input" value={view.useCase ?? ''} onChange={(event) => onPatchView({ useCase: event.target.value }, `${view.id}:useCase`)} onBlur={onEndBatch} placeholder={copy.useCasePlaceholder} /></Field>
      <Field label={copy.viewName}><input className="inspector-input" value={view.name} onChange={(event) => onPatchView({ name: event.target.value }, `${view.id}:name`)} onBlur={onEndBatch} placeholder={copy.defaultView} /></Field>
      <Field label={copy.description}><textarea className="inspector-input min-h-[56px]" value={view.description} onChange={(event) => onPatchView({ description: event.target.value }, `${view.id}:description`)} onBlur={onEndBatch} /></Field>
      {targets.length > 0 && (
        <Field label={copy.addDiagramRef}>
          <div className="flex gap-1">
            <select className="inspector-input py-1" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">{copy.noTarget}</option>
              {targets.map((candidate) => <option key={candidate.id} value={candidate.id}>{dfdLabel(copy, candidate)} · {copy.viewKinds[candidate.kind]}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-xs shrink-0 border border-line" disabled={!target} onClick={() => { if (target) { actions.addDiagramRef(target); setTarget('') } }}><Icon name="plus" size={12} /></button>
          </div>
        </Field>
      )}
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.boundaries} · {boundaries.length}</div>
      {boundaries.map((boundary) => (
        <button key={boundary.id} type="button" onClick={() => onSelect(boundary.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content">
          <span className={`h-2 w-2 shrink-0 rounded-full ${boundary.consistency === 'atomic' ? 'bg-blue-500' : 'bg-amber'}`} />
          <span className="truncate">{boundary.name}</span>
          <span className="ml-auto text-[10px]">{boundary.flowIds.length}</span>
        </button>
      ))}
      <p className="mt-1 text-[10px] leading-4 text-muted">{copy.newBoundaryHint}</p>
    </div>
  )
}

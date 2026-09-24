import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { componentType, createCategory, createDictionaryDomain, deleteCategory, deleteDomain, domainTypeLabel, domainUsage, expandColumns, formatType, isDefined, makeCodeSetEntry, makeComponent, mergeCandidates, mergeConflicts, mergeDomains, patchCategory, patchDomain, type MergeCandidate } from '../core/domains'
import { fromTranslation, localSuggestions, SAFE_RESOLUTIONS, type NameSuggestion } from '../core/suggest'
import { translateToEnglish, translatorPresent } from './translator'
import { CODE_SET_BASES, DOMAIN_SHAPES, IDENTIFIER_CASES, PRIMITIVE_KINDS, TRANSLITERATIONS, type Transliteration, type CodeSet, type DataDomain, type DomainComponent, type DomainShape, type IdentifierCase, type PrimitiveKind, type Project, type NameMode, type TableNumber, type TypeSpec, type VocabularyEntry } from '../core/model'
import { renderType } from '../core/ddl'
import { addEntry, attributeName, conflictingEntry, displayName, deleteEntry, derivePhysicalNames, patchEntry, renameEntry, termIndex, unregisteredWords, vocabularyUsage, type BoundOwner, type MentionRef } from '../core/vocabulary'
import type { Finding } from '../core/validate'
import { DfdsCatalog, TablesCatalog } from './Catalogs'
import { ExportButtons } from './CatalogTable'
import type { Copy } from './i18n'
import { Icon } from './icons'

export const DOMAIN_DRAG_TYPE = 'application/x-archidiag-domain'

export type DictionaryTab = 'vocabulary' | 'domains' | 'tables' | 'dfds'

export type RevealTarget = { kind: 'element'; id: string } | { kind: 'relationship'; id: string } | { kind: 'flow'; id: string; viewId: string }

export interface DictionaryPanelProps {
  project: Project
  copy: Copy
  tab: DictionaryTab
  focusId?: string
  onNavigate: (tab: DictionaryTab, focusId?: string) => void
  onClose: () => void
  /** batchKey folds keystrokes into one undo step until onEndBatch. */
  commit: (update: (project: Project) => Project, batchKey?: string) => void
  onEndBatch: () => void
  onReveal: (target: RevealTarget) => void
  say: (message: string) => void
  /** Name form of the open diagram; catalogs list and export names in it. */
  nameMode: NameMode
  findings: Finding[]
  onOpenView: (viewId: string) => void
}

/** Enter submits unless an IME composition is in progress, and the input stays ready for the next entry. */
export function QuickEntry({ placeholder, onSubmit, className = '' }: { placeholder: string; onSubmit: (value: string) => void; className?: string }) {
  const [value, setValue] = useState('')
  const composing = useRef(false)
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || composing.current || event.nativeEvent.isComposing) return
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }
  return <input className={`inspector-input py-1.5 text-xs ${className}`} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={onKey} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} />
}

/** A text field that applies its value on blur or Enter, for edits that rewrite other names. Escape restores. */
function CommitInput({ value, onCommit, className = '', placeholder }: { value: string; onCommit: (value: string) => void; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value)
  const composing = useRef(false)
  useEffect(() => { setDraft(value) }, [value])
  const apply = () => { if (draft.trim() && draft !== value) onCommit(draft); else setDraft(value) }
  return (
    <input
      className={className}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={apply}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing) { event.preventDefault(); apply() }
        if (event.key === 'Escape') setDraft(value)
      }}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={() => { composing.current = false }}
    />
  )
}

function Section({ title, count, children, action }: { title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{title}{count !== undefined ? ` · ${count}` : ''}</div>{action}</div>
      {children}
    </div>
  )
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-muted">{text}<div className="mt-1 normal-case tracking-normal">{children}</div></label>
}

export function DictionaryPanel(props: DictionaryPanelProps) {
  const { copy, tab, onNavigate, onClose } = props
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line/80 px-5 py-2">
        <div className="flex items-center gap-3">
          <Icon name="tag" size={15} className="text-cyan" />
          <div className="join border border-line bg-panel/60">
            {(['vocabulary', 'domains', 'tables', 'dfds'] as DictionaryTab[]).map((item) => (
              <button key={item} type="button" className={`btn btn-ghost btn-xs join-item ${tab === item ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`} onClick={() => onNavigate(item)}>{{ vocabulary: copy.dict.vocabulary, domains: copy.dict.domains, tables: copy.catalog.tables, dfds: copy.catalog.dfds }[item]}</button>
            ))}
          </div>
          <span className="text-[11px] text-muted">{{ vocabulary: copy.dict.vocabularyHint, domains: copy.dict.domainsHint, tables: copy.catalog.tablesHint, dfds: copy.catalog.dfdsHint }[tab]}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-xs text-muted hover:text-base-content" onClick={onClose}><Icon name="x" size={13} />{copy.dict.backToDiagram}</button>
      </div>
      {tab === 'vocabulary' && <VocabularyView {...props} />}
      {tab === 'domains' && <DomainView {...props} />}
      {tab === 'tables' && <TablesCatalog project={props.project} copy={copy} findings={props.findings} nameMode={props.nameMode} selectedId={props.focusId} onOpen={(id) => { onNavigate('tables', id); props.onReveal({ kind: 'element', id }) }} />}
      {tab === 'dfds' && <DfdsCatalog project={props.project} copy={copy} findings={props.findings} onOpen={(viewId) => { onClose(); props.onOpenView(viewId) }} />}
    </div>
  )
}

// ---------- vocabulary ----------

function VocabularyView({ project, copy, focusId, onNavigate, commit, onEndBatch, onReveal, say }: DictionaryPanelProps) {
  const [search, setSearch] = useState('')
  const usage = useMemo(() => vocabularyUsage(project), [project])
  const unregistered = useMemo(() => unregisteredWords(project), [project])
  const duplicates = useMemo(() => new Set(termIndex(project.vocabulary).duplicates), [project.vocabulary])
  const entries = useMemo(() => Object.values(project.vocabulary)
    .filter((entry) => !search || [entry.businessName, entry.systemName, entry.physicalName, entry.meaning, ...entry.aliases].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.businessName.localeCompare(b.businessName)), [project.vocabulary, search])
  const selected = focusId ? project.vocabulary[focusId] : undefined
  const policy = project.settings.namingPolicy
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([])
  const [suggesting, setSuggesting] = useState(false)
  /** Local candidates first; the on-device translator adds candidates for names no term covers (requirement: name-suggestion). */
  const suggest = async (targets: VocabularyEntry[]) => {
    const missing = targets.filter((entry) => !entry.systemName.trim() || !entry.physicalName.trim())
    if (!missing.length) { say(copy.dict.nothingToSuggest); return }
    const local = missing.flatMap((entry) => localSuggestions(project, entry))
    setSuggestions((current) => [...current.filter((item) => !missing.some((entry) => entry.id === item.entryId)), ...local])
    const foreign = policy.transliteration === 'translate' ? missing.filter((entry) => !/^[\x20-\x7e]+$/.test(entry.businessName) && !local.some((item) => item.entryId === entry.id && SAFE_RESOLUTIONS.includes(item.resolution))) : []
    if (foreign.length && translatorPresent()) {
      setSuggesting(true)
      const translated = await translateToEnglish(foreign.map((entry) => entry.businessName))
      setSuggesting(false)
      const extra = foreign.flatMap((entry) => (translated.get(entry.businessName) ? fromTranslation(project, entry, translated.get(entry.businessName)!, copy.dict.chromeAi) : []))
      setSuggestions((current) => [...current, ...extra.filter((item) => !current.some((other) => other.entryId === item.entryId && other.target === item.target && other.value === item.value))])
    }
    say(copy.dict.suggested(local.length))
  }
  const accept = (items: NameSuggestion[]) => {
    if (!items.length) return
    commit((current) => items.reduce((next, item) => patchEntry(next, item.entryId, item.target === 'system_name' ? { systemName: item.value } : { physicalName: item.value }), current))
    setSuggestions((current) => current.filter((other) => !items.some((item) => item.entryId === other.entryId && item.target === other.target)))
    say(copy.dict.accepted(items.length))
  }
  const reject = (item: NameSuggestion) => setSuggestions((current) => current.filter((other) => other !== item))
  // One safe candidate per entry and target: reuse or composition from confirmed entries.
  const safe = suggestions.filter((item, index) => SAFE_RESOLUTIONS.includes(item.resolution) && suggestions.findIndex((other) => other.entryId === item.entryId && other.target === item.target && SAFE_RESOLUTIONS.includes(other.resolution)) === index)
  const setPolicy = (patch: Partial<typeof policy>) => commit((current) => ({ ...current, settings: { ...current.settings, namingPolicy: { ...current.settings.namingPolicy, ...patch } } }))
  const register = (businessName: string) => {
    const existing = Object.values(project.vocabulary).find((entry) => entry.businessName.trim().toLowerCase() === businessName.trim().toLowerCase())
    if (existing) { onNavigate('vocabulary', existing.id); return }
    let created: VocabularyEntry | undefined
    commit((current) => { const result = addEntry(current, businessName); created = result.entry; return result.project })
    if (created) onNavigate('vocabulary', created.id)
  }
  const cell = 'w-full rounded bg-transparent px-1.5 py-1 text-xs outline-none hover:bg-white/5 focus:bg-ink/70 focus:ring-1 focus:ring-cyan/40'
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 flex-col border-r border-line/80">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-4 py-2">
          <QuickEntry className="w-56" placeholder={copy.dict.addTerm} onSubmit={register} />
          <label className="flex items-center gap-1.5 rounded-lg border border-line bg-ink/45 px-2 py-1 text-xs text-muted"><Icon name="search" size={12} /><input className="w-36 bg-transparent text-base-content outline-none" placeholder={copy.dict.search} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <button type="button" className="btn btn-ghost btn-xs text-violet" title={copy.dict.suggestHint} disabled={suggesting} onClick={() => suggest(Object.values(project.vocabulary))}><Icon name="wand" size={12} />{suggesting ? copy.dict.suggesting : copy.dict.suggestMissing}</button>
          <span className="ml-auto"><ExportButtons copy={copy} name={`${project.name}-vocabulary`} headers={[copy.dict.businessName, copy.dict.systemName, copy.dict.physicalName, copy.dict.physicalPlural, copy.dict.aliases, copy.dict.meaning, copy.dict.bindings, copy.dict.mentions]} rows={entries.map((entry) => [entry.businessName, entry.systemName, entry.physicalName, entry.physicalNamePlural ?? '', entry.aliases.join(', '), entry.meaning, usage.get(entry.id)?.bindings.length ?? 0, usage.get(entry.id)?.mentions.length ?? 0])} /></span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-4 py-1.5 text-[11px] text-muted">
          <span className="whitespace-nowrap text-[10px] uppercase tracking-wider" title={copy.dict.policyHint}>{copy.dict.policy}</span>
          <select className="rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]" value={policy.identifierCase} onChange={(event) => setPolicy({ identifierCase: event.target.value as IdentifierCase })}>{IDENTIFIER_CASES.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select className="rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]" value={policy.tableNumber} onChange={(event) => setPolicy({ tableNumber: event.target.value as TableNumber })}><option value="singular">{copy.dict.singular}</option><option value="plural">{copy.dict.plural}</option></select>
          <select className="rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]" title={copy.dict.transliterationHint} value={policy.transliteration} onChange={(event) => setPolicy({ transliteration: event.target.value as Transliteration })}>{TRANSLITERATIONS.map((option) => <option key={option} value={option}>{copy.dict.transliterations[option]}</option>)}</select>
          <button type="button" className="btn btn-ghost btn-xs ml-auto whitespace-nowrap text-muted hover:text-cyan" title={copy.dict.derivePhysicalHint} onClick={() => { const result = derivePhysicalNames(project); if (result.count) commit(() => result.project); say(copy.dict.derived(result.count)) }}><Icon name="wand" size={12} />{copy.dict.derivePhysical}</button>
        </div>
        {suggestions.length > 0 && (
          <div className="max-h-56 overflow-auto border-b border-line/60 bg-violet/5 px-4 py-2 text-xs">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet">{copy.dict.suggestions} · {suggestions.length}</span>
              <button type="button" className="btn btn-primary btn-xs text-ink" disabled={!safe.length} title={copy.dict.acceptSafeHint} onClick={() => accept(safe)}>{copy.dict.acceptSafe(safe.length)}</button>
              <button type="button" className="btn btn-ghost btn-xs text-muted" onClick={() => setSuggestions([])}>{copy.dict.clear}</button>
            </div>
            {suggestions.map((item, index) => (
              <div key={`${item.entryId}-${item.target}-${item.value}-${index}`} className="flex items-center gap-2 border-b border-line/30 py-1 last:border-b-0">
                <button type="button" className="w-32 shrink-0 truncate text-left font-semibold hover:text-cyan" onClick={() => onNavigate('vocabulary', item.entryId)}>{project.vocabulary[item.entryId]?.businessName}</button>
                <span className="w-20 shrink-0 text-[10px] text-muted">{item.target === 'system_name' ? copy.dict.systemName : copy.dict.physicalName}</span>
                <span className={`min-w-0 flex-1 truncate ${item.target === 'physical_name' ? 'font-mono' : ''}`}>{item.value}</span>
                <span className="w-44 shrink-0 truncate text-[10px] text-muted" title={item.rationale}>{copy.dict.resolutions[item.resolution]} · {item.provider}</span>
                <button type="button" className="text-[11px] text-cyan hover:underline" onClick={() => accept([item])}>{copy.dict.accept}</button>
                <button type="button" className="text-[11px] text-muted hover:text-rose-400" onClick={() => reject(item)}>{copy.dict.reject}</button>
              </div>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="sticky top-0 z-10 bg-panel text-left text-[10px] uppercase tracking-wider text-muted">
              <tr><th className="w-[28%] px-3 py-1.5">{copy.dict.businessName}</th><th className="w-[28%] px-3 py-1.5">{copy.dict.systemName}</th><th className="w-[28%] px-3 py-1.5">{copy.dict.physicalName}</th><th className="px-3 py-1.5 text-right">{copy.dict.uses}</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const used = usage.get(entry.id)
                const duplicate = [entry.businessName, ...entry.aliases].some((term) => duplicates.has(term.trim().toLowerCase()))
                return (
                  <tr key={entry.id} className={`border-b border-line/40 ${entry.id === focusId ? 'bg-cyan/10' : 'hover:bg-white/[0.03]'}`} onClick={() => onNavigate('vocabulary', entry.id)}>
                    <td className="truncate px-3 py-1">
                      <span className="flex items-center gap-1">{duplicate && <span title={copy.dict.duplicateTerm}><Icon name="warning" size={11} className="shrink-0 text-amber" /></span>}<span className="truncate font-semibold">{entry.businessName}</span>{entry.aliases.length > 0 && <span className="truncate text-[10px] text-muted">= {entry.aliases.join(', ')}</span>}</span>
                    </td>
                    <td className="px-2 py-0.5"><input className={cell} value={entry.systemName} placeholder="—" onChange={(event) => commit((current) => patchEntry(current, entry.id, { systemName: event.target.value }), `${entry.id}:system`)} onBlur={onEndBatch} onFocus={() => onNavigate('vocabulary', entry.id)} /></td>
                    <td className="px-2 py-0.5"><input className={`${cell} font-mono`} value={entry.physicalName} placeholder="—" onChange={(event) => commit((current) => patchEntry(current, entry.id, { physicalName: event.target.value }), `${entry.id}:physical`)} onBlur={onEndBatch} onFocus={() => onNavigate('vocabulary', entry.id)} /></td>
                    <td className="px-3 py-1 text-right text-muted" title={copy.dict.usesHint}>{used?.bindings.length ?? 0}<span className="opacity-60"> / {used?.mentions.length ?? 0}</span></td>
                  </tr>
                )
              })}
              {!entries.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted">{Object.keys(project.vocabulary).length ? copy.dict.noMatch : copy.dict.emptyVocabulary}</td></tr>}
            </tbody>
          </table>
          {unregistered.length > 0 && (
            <div className="border-t border-line/60 px-4 py-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{copy.dict.unregistered} · {unregistered.length}</div>
              <p className="mb-2 text-[10px] leading-4 text-muted">{copy.dict.unregisteredHint}</p>
              <div className="flex flex-wrap gap-1">
                {unregistered.slice(0, 80).map((item) => (
                  <button key={item.word} type="button" className="flex items-center gap-1 rounded-md border border-dashed border-rose-400/50 px-1.5 py-0.5 text-[11px] text-rose-200 hover:border-cyan hover:text-cyan" title={item.owners.slice(0, 8).map((owner) => owner.label).join('\n')} onClick={() => register(item.word)}>
                    <Icon name="plus" size={10} />{item.word}<span className="text-[9px] opacity-70">×{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto p-4">
        {selected ? <EntryDetail key={selected.id} entry={selected} project={project} copy={copy} usage={usage.get(selected.id) ?? { bindings: [], mentions: [] }} commit={commit} onEndBatch={onEndBatch} onNavigate={onNavigate} onReveal={onReveal} onSuggest={() => suggest([selected])} say={say} /> : <p className="text-xs leading-5 text-muted">{copy.dict.selectEntry}</p>}
      </div>
    </div>
  )
}

function ownerTarget(owner: BoundOwner): { tab: 'domains'; id: string } | { elementId: string } {
  if (owner.ref.ownerKind === 'domain') return { tab: 'domains', id: owner.ref.domainId }
  return { elementId: owner.ref.elementId }
}

function mentionTarget(ref: MentionRef): RevealTarget {
  if (ref.mentionKind === 'element') return { kind: 'element', id: ref.elementId }
  if (ref.mentionKind === 'relationship') return { kind: 'relationship', id: ref.relationshipId }
  return { kind: 'flow', id: ref.flowId, viewId: ref.viewId }
}

function EntryDetail({ entry, project, copy, usage, commit, onEndBatch, onNavigate, onReveal, onSuggest, say }: { entry: VocabularyEntry; project: Project; copy: Copy; usage: { bindings: BoundOwner[]; mentions: Array<{ ref: MentionRef; label: string }> }; commit: DictionaryPanelProps['commit']; onEndBatch: () => void; onNavigate: DictionaryPanelProps['onNavigate']; onReveal: (target: RevealTarget) => void; onSuggest: () => void; say: (message: string) => void }) {
  const patch = (value: Partial<VocabularyEntry>, key?: string) => commit((current) => patchEntry(current, entry.id, value), key ? `${entry.id}:${key}` : undefined)
  const plural = project.settings.namingPolicy.tableNumber === 'plural'
  const ownerIcon = (owner: BoundOwner) => (owner.ref.ownerKind === 'entity' ? 'table' : owner.ref.ownerKind === 'attribute' ? 'key' : owner.ref.ownerKind === 'domain' ? 'tag' : 'box')
  return (
    <div>
      <Label text={copy.dict.businessName}>
        <CommitInput className="inspector-input font-semibold" value={entry.businessName} onCommit={(value) => { const clash = conflictingEntry(project, entry.id, value); if (clash) { say(copy.dict.renameClash(clash.businessName)); return } commit((current) => renameEntry(current, entry.id, value)) }} />
        <p className="mt-1 text-[10px] leading-4 text-muted">{copy.dict.renameHint(usage.bindings.length)}</p>
      </Label>
      <Label text={copy.dict.systemName}><input className="inspector-input" value={entry.systemName} onChange={(event) => patch({ systemName: event.target.value }, 'system')} onBlur={onEndBatch} /></Label>
      <Label text={copy.dict.physicalName}><input className="inspector-input font-mono" value={entry.physicalName} onChange={(event) => patch({ physicalName: event.target.value }, 'physical')} onBlur={onEndBatch} /></Label>
      {(!entry.systemName.trim() || !entry.physicalName.trim()) && <button type="button" className="btn btn-ghost btn-xs mb-3 text-violet" onClick={onSuggest}><Icon name="wand" size={12} />{copy.dict.suggestThis}</button>}
      {(plural || entry.physicalNamePlural) && <Label text={copy.dict.physicalPlural}><input className="inspector-input font-mono" value={entry.physicalNamePlural ?? ''} onChange={(event) => patch({ physicalNamePlural: event.target.value || undefined }, 'plural')} onBlur={onEndBatch} /></Label>}
      <Label text={copy.dict.aliases}>
        <CommitInput className="inspector-input" value={entry.aliases.join(', ')} placeholder={copy.dict.aliasesPlaceholder} onCommit={(value) => patch({ aliases: [...new Set(value.split(/[,、]/).map((alias) => alias.trim()).filter(Boolean))] })} />
      </Label>
      <Label text={copy.dict.meaning}><textarea className="inspector-input min-h-[56px]" value={entry.meaning} onChange={(event) => patch({ meaning: event.target.value }, 'meaning')} onBlur={onEndBatch} /></Label>
      <Label text={copy.dict.notes}><textarea className="inspector-input min-h-[40px]" value={entry.notes} onChange={(event) => patch({ notes: event.target.value }, 'notes')} onBlur={onEndBatch} /></Label>
      <label className="mb-4 flex cursor-pointer items-start gap-2 text-xs"><input type="checkbox" className="checkbox checkbox-xs mt-0.5" checked={Boolean(entry.policyException)} onChange={(event) => patch({ policyException: event.target.checked || undefined })} /><span>{copy.dict.policyException}<span className="block text-[10px] leading-4 text-muted">{copy.dict.policyExceptionHint}</span></span></label>
      <Section title={copy.dict.bindings} count={usage.bindings.length}>
        {usage.bindings.map((owner, index) => {
          const target = ownerTarget(owner)
          return <button key={index} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content" onClick={() => ('tab' in target ? onNavigate(target.tab, target.id) : onReveal({ kind: 'element', id: target.elementId }))}><Icon name={ownerIcon(owner)} size={11} className="shrink-0" /><span className="truncate">{owner.label}</span></button>
        })}
        {!usage.bindings.length && <p className="px-2 text-[10px] text-muted">{copy.dict.noBindings}</p>}
      </Section>
      <Section title={copy.dict.mentions} count={usage.mentions.length}>
        {usage.mentions.slice(0, 50).map((mention, index) => <button key={index} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content" onClick={() => onReveal(mentionTarget(mention.ref))}><Icon name={mention.ref.mentionKind === 'flow' ? 'flow' : mention.ref.mentionKind === 'relationship' ? 'link' : 'box'} size={11} className="shrink-0" /><span className="truncate">{mention.label || '—'}</span>{mention.ref.mentionKind === 'element' && mention.ref.field === 'description' && <span className="ml-auto text-[9px] opacity-60">{copy.description}</span>}</button>)}
        {!usage.mentions.length && <p className="px-2 text-[10px] text-muted">{copy.dict.noMentions}</p>}
      </Section>
      <button type="button" className="btn btn-ghost btn-sm w-full justify-start text-rose-400 hover:bg-rose-500/10" onClick={() => { commit((current) => deleteEntry(current, entry.id)); onNavigate('vocabulary') }}><Icon name="trash" size={14} />{copy.dict.deleteEntry}</button>
    </div>
  )
}

// ---------- domains ----------

type DomainFilter = 'all' | 'candidates' | 'uncurated' | 'single_use' | 'unresolved'

function TypeEditor({ value, kinds, onChange, copy }: { value?: TypeSpec; kinds: PrimitiveKind[]; onChange: (type: TypeSpec | undefined) => void; copy: Copy }) {
  const number = (key: 'length' | 'precision' | 'scale', label: string) => (
    <input type="number" min="0" className="w-16 rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]" placeholder={label} title={label} value={value?.[key] ?? ''} onChange={(event) => value && onChange({ ...value, [key]: event.target.value === '' ? undefined : Number(event.target.value) })} />
  )
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select className="rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]" value={value?.primitive ?? ''} onChange={(event) => onChange(event.target.value ? { primitive: event.target.value as PrimitiveKind, ...(event.target.value === 'varchar' ? { length: value?.length } : {}), ...(event.target.value === 'numeric' ? { precision: value?.precision, scale: value?.scale } : {}) } : undefined)}>
        <option value="">{copy.dict.chooseType}</option>
        {kinds.map((kind) => <option key={kind} value={kind}>{formatType({ primitive: kind })}</option>)}
      </select>
      {value?.primitive === 'varchar' && number('length', copy.dict.length)}
      {value?.primitive === 'numeric' && <>{number('precision', copy.dict.precision)}{number('scale', copy.dict.scale)}</>}
    </div>
  )
}

function DomainView({ project, copy, focusId, onNavigate, commit, onEndBatch, onReveal, say, nameMode }: DictionaryPanelProps) {
  // Dialect renderings of a single-field or code set type, for the catalog export.
  const dialectType = (domain: DataDomain, dialect: 'sqlite' | 'mysql') => { const type = domain.shape === 'single_field' ? domain.type : domain.shape === 'code_set' ? domain.codeSet?.base : undefined; return type ? renderType(dialect, type).type : '' }
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DomainFilter>('all')
  const [category, setCategory] = useState<string>('')
  const [checked, setChecked] = useState<string[]>([])
  const [survivorId, setSurvivorId] = useState<string>('')
  const [rename, setRename] = useState('')
  const usage = useMemo(() => domainUsage(project), [project])
  const candidates = useMemo(() => mergeCandidates(project), [project])
  const inCandidates = useMemo(() => new Set(candidates.flatMap((candidate) => candidate.domainIds)), [candidates])
  const categories = Object.values(project.domainCategories).sort((a, b) => a.name.localeCompare(b.name))
  const typeLabel = (domain: DataDomain) => domainTypeLabel(project, domain)
  const matches = (domain: DataDomain) => {
    if (category && domain.categoryId !== category) return false
    const count = usage.get(domain.id)?.length ?? 0
    if (filter === 'candidates' && !inCandidates.has(domain.id)) return false
    if (filter === 'uncurated' && domain.curated) return false
    if (filter === 'single_use' && count !== 1) return false
    if (filter === 'unresolved' && isDefined(project, domain)) return false
    if (!search) return true
    const haystack = [domain.name, typeLabel(domain), domain.description, project.domainCategories[domain.categoryId ?? '']?.name ?? '', ...(domain.components ?? []).map((component) => component.name)].join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  }
  // Uncurated and candidate domains lead (decision: field-first-domains): the dictionary is where they get consolidated.
  const rank = (domain: DataDomain) => (inCandidates.has(domain.id) ? 0 : !domain.curated ? 1 : 2)
  const domains = Object.values(project.domains).filter(matches).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  const selected = focusId ? project.domains[focusId] : undefined
  const startMerge = (candidate: MergeCandidate) => {
    const ids = candidate.domainIds.filter((id) => project.domains[id])
    // The survivor defaults to a curated or typed domain, else the most used one.
    const best = [...ids].sort((a, b) => Number(project.domains[b].curated) - Number(project.domains[a].curated) || Number(isDefined(project, project.domains[b])) - Number(isDefined(project, project.domains[a])) || (usage.get(b)?.length ?? 0) - (usage.get(a)?.length ?? 0))[0]
    setChecked(ids)
    setSurvivorId(best)
    setRename('')
  }
  const toggle = (id: string) => setChecked((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    if (!next.includes(survivorId)) setSurvivorId(next[0] ?? '')
    return next
  })
  const survivor = checked.includes(survivorId) ? survivorId : checked[0]
  const conflicts = survivor ? mergeConflicts(project, survivor, checked) : []
  const merge = () => {
    if (!survivor || checked.length < 2) return
    const result = mergeDomains(project, survivor, checked, rename)
    commit(() => result.project)
    say(copy.dict.merged(checked.length, result.project.domains[survivor]?.name ?? ''))
    setChecked([])
    setRename('')
    onNavigate('domains', survivor)
  }
  const create = (name: string) => {
    let id = ''
    commit((current) => { const result = createDictionaryDomain(current, name); id = result.domain.id; return result.project })
    if (id) onNavigate('domains', id)
  }
  const reasonLabel = (reason: MergeCandidate['reason']) => copy.dict.reasons[reason]
  const filters: DomainFilter[] = ['all', 'candidates', 'uncurated', 'single_use', 'unresolved']
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-0 flex-col border-r border-line/80">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-4 py-2">
          <QuickEntry className="w-56" placeholder={copy.dict.addDomain} onSubmit={create} />
          <label className="flex items-center gap-1.5 rounded-lg border border-line bg-ink/45 px-2 py-1 text-xs text-muted"><Icon name="search" size={12} /><input className="w-36 bg-transparent text-base-content outline-none" placeholder={copy.dict.searchDomains} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="join border border-line bg-panel/60">
            {filters.map((option) => <button key={option} type="button" className={`btn btn-ghost btn-xs join-item ${filter === option ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`} onClick={() => setFilter(option)}>{copy.dict.filters[option]}</button>)}
          </div>
          <span className="ml-auto"><ExportButtons copy={copy} name={`${project.name}-domains`} headers={[copy.dict.domain, copy.dict.type, 'SQLite', 'MySQL', copy.dict.category, copy.dict.shape, copy.dict.curated, copy.dict.originField, copy.dict.fields, copy.description]} rows={domains.map((domain) => [displayName(project, domain.name, nameMode).text, typeLabel(domain), dialectType(domain, 'sqlite'), dialectType(domain, 'mysql'), project.domainCategories[domain.categoryId ?? '']?.name ?? '', copy.dict.shapes[domain.shape], domain.curated, domain.origin === 'from_field', usage.get(domain.id)?.length ?? 0, domain.description])} /></span>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-b border-line/60 px-4 py-1.5 text-[11px]">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-muted">{copy.dict.categories}</span>
          <button type="button" className={`rounded-md px-2 py-0.5 ${category === '' ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/5'}`} onClick={() => setCategory('')}>{copy.dict.allCategories}</button>
          {categories.map((item) => (
            category === item.id ? (
              <span key={item.id} className="flex items-center gap-1 rounded-md bg-cyan/15 px-1 py-0.5">
                <CommitInput className="w-28 bg-transparent px-1 text-cyan outline-none" value={item.name} onCommit={(value) => commit((current) => patchCategory(current, item.id, value.trim()))} />
                <button type="button" className="text-muted hover:text-rose-400" title={copy.dict.deleteCategory} onClick={() => { commit((current) => deleteCategory(current, item.id)); setCategory('') }}><Icon name="x" size={11} /></button>
              </span>
            ) : <button key={item.id} type="button" className="rounded-md px-2 py-0.5 text-muted hover:bg-white/5" onClick={() => setCategory(item.id)}>{item.name}</button>
          ))}
          <QuickEntry className="!w-32 !py-0.5 !text-[11px]" placeholder={copy.dict.addCategory} onSubmit={(name) => { let id = ''; commit((current) => { const result = createCategory(current, name); id = result.category.id; return result.project }); setCategory(id) }} />
        </div>
        {checked.length > 0 && (
          <div className="border-b border-line/60 bg-cyan/5 px-4 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{copy.dict.mergeSelected(checked.length)}</span>
              <span className="text-muted">{copy.dict.survivor}</span>
              <select className="rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]" value={survivor} onChange={(event) => setSurvivorId(event.target.value)}>{checked.map((id) => <option key={id} value={id}>{project.domains[id]?.name}</option>)}</select>
              <input className="w-40 rounded-md border border-line bg-ink/60 px-2 py-1 text-[11px]" placeholder={copy.dict.renameSurvivor} value={rename} onChange={(event) => setRename(event.target.value)} />
              <button type="button" className="btn btn-primary btn-xs text-ink" disabled={checked.length < 2} onClick={merge}>{copy.dict.merge}</button>
              <button type="button" className="btn btn-ghost btn-xs text-muted" onClick={() => setChecked([])}>{copy.dict.cancel}</button>
            </div>
            {conflicts.length > 0 && <div className="mt-1.5 text-[11px] text-amber"><Icon name="warning" size={11} className="mr-1 inline" />{copy.dict.conflicts}: {conflicts.join(' · ')}</div>}
            {checked.length < 2 && <div className="mt-1 text-[10px] text-muted">{copy.dict.mergeNeedsTwo}</div>}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {candidates.length > 0 && (filter === 'all' || filter === 'candidates') && (
            <div className="border-b border-line/60 px-4 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber">{copy.dict.mergeCandidates} · {candidates.length}</div>
              {candidates.map((candidate) => (
                <div key={candidate.domainIds.join('|')} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="w-28 shrink-0 text-[10px] text-muted">{reasonLabel(candidate.reason)}</span>
                  <span className="min-w-0 flex-1 truncate">{candidate.domainIds.map((id) => project.domains[id]?.name).join(' · ')}</span>
                  <button type="button" className="shrink-0 text-[11px] text-cyan hover:underline" onClick={() => startMerge(candidate)}>{copy.dict.mergeEllipsis}</button>
                </div>
              ))}
            </div>
          )}
          <table className="w-full table-fixed text-xs">
            <thead className="sticky top-0 z-10 bg-panel text-left text-[10px] uppercase tracking-wider text-muted">
              <tr><th className="w-8 px-2 py-1.5" /><th className="w-[34%] px-2 py-1.5">{copy.dict.domain}</th><th className="px-2 py-1.5">{copy.dict.type}</th><th className="w-[18%] px-2 py-1.5">{copy.dict.category}</th><th className="w-20 whitespace-nowrap px-2 py-1.5 text-right">{copy.dict.fields}</th></tr>
            </thead>
            <tbody>
              {domains.map((domain) => {
                const count = usage.get(domain.id)?.length ?? 0
                const defined = isDefined(project, domain)
                return (
                  <tr key={domain.id} draggable onDragStart={(event) => { event.dataTransfer.setData(DOMAIN_DRAG_TYPE, domain.id); event.dataTransfer.effectAllowed = 'link' }} className={`cursor-pointer border-b border-line/40 ${domain.id === focusId ? 'bg-cyan/10' : 'hover:bg-white/[0.03]'}`} onClick={() => onNavigate('domains', domain.id)} title={copy.dict.dragDomain}>
                    <td className="px-2 py-1" onClick={(event) => event.stopPropagation()}><input type="checkbox" className="checkbox checkbox-xs" checked={checked.includes(domain.id)} onChange={() => toggle(domain.id)} /></td>
                    <td className="truncate px-2 py-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${defined ? 'bg-cyan' : 'border border-dashed border-amber'}`} title={defined ? copy.dict.defined : copy.dict.unresolved} />
                        <span className="truncate font-semibold">{domain.name}</span>
                        {domain.origin === 'dictionary' && <span title={copy.dict.originDictionary}><Icon name="tag" size={10} className="shrink-0 text-violet" /></span>}
                        {domain.curated ? <span title={copy.dict.curated}><Icon name="check" size={10} className="shrink-0 text-emerald-400" /></span> : <span className="shrink-0 rounded bg-white/5 px-1 text-[9px] text-muted" title={copy.dict.uncuratedHint}>{copy.dict.auto}</span>}
                        {inCandidates.has(domain.id) && <span title={copy.dict.mergeCandidates}><Icon name="warning" size={10} className="shrink-0 text-amber" /></span>}
                      </span>
                    </td>
                    <td className={`truncate px-2 py-1 font-mono text-[11px] ${defined ? '' : 'text-amber/80'}`}>{typeLabel(domain) || copy.dict.unresolved}</td>
                    <td className="truncate px-2 py-1 text-muted">{project.domainCategories[domain.categoryId ?? '']?.name ?? ''}</td>
                    <td className="px-2 py-1 text-right text-muted">{count}</td>
                  </tr>
                )
              })}
              {!domains.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">{Object.keys(project.domains).length ? copy.dict.noMatch : copy.dict.emptyDomains}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto p-4">
        {selected ? <DomainDetail key={selected.id} domain={selected} project={project} copy={copy} usage={usage.get(selected.id) ?? []} commit={commit} onEndBatch={onEndBatch} onNavigate={onNavigate} onReveal={onReveal} /> : <p className="text-xs leading-5 text-muted">{copy.dict.selectDomain}</p>}
      </div>
    </div>
  )
}

function DomainDetail({ domain, project, copy, usage, commit, onEndBatch, onNavigate, onReveal }: { domain: DataDomain; project: Project; copy: Copy; usage: ReturnType<typeof domainUsage> extends Map<string, infer T> ? T : never; commit: DictionaryPanelProps['commit']; onEndBatch: () => void; onNavigate: DictionaryPanelProps['onNavigate']; onReveal: (target: RevealTarget) => void }) {
  const patch = (value: Partial<DataDomain>, key?: string) => commit((current) => patchDomain(current, domain.id, value), key ? `${domain.id}:${key}` : undefined)
  const setShape = (shape: DomainShape) => patch({ shape, ...(shape === 'multi_field' && !domain.components ? { components: [] } : {}), ...(shape === 'code_set' && !domain.codeSet ? { codeSet: { base: { primitive: 'varchar' }, entries: [] } } : {}) })
  const components = domain.components ?? []
  const setComponents = (next: DomainComponent[], key?: string) => patch({ components: next }, key)
  const codeSet: CodeSet = domain.codeSet ?? { base: { primitive: 'varchar' }, entries: [] }
  const setCodeSet = (next: CodeSet, key?: string) => patch({ codeSet: next }, key)
  const move = <T,>(items: T[], index: number, delta: -1 | 1): T[] => { const next = [...items]; const target = index + delta; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next }
  const singleDomains = Object.values(project.domains).filter((other) => other.id !== domain.id && other.shape === 'single_field' && other.type).sort((a, b) => a.name.localeCompare(b.name))
  const columns = usage[0] ? expandColumns(project, usage[0].attribute) : []
  const small = 'rounded-md border border-line bg-ink/60 px-1.5 py-1 text-[11px]'
  return (
    <div>
      <Label text={copy.dict.domainName}><input className="inspector-input font-semibold" value={domain.name} onChange={(event) => patch({ name: event.target.value }, 'name')} onBlur={onEndBatch} /></Label>
      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-muted">{domain.origin === 'dictionary' ? copy.dict.originDictionary : copy.dict.originField}</span>
        <span className={`rounded px-1.5 py-0.5 ${domain.curated ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber/10 text-amber'}`}>{domain.curated ? copy.dict.curated : copy.dict.uncurated}</span>
        <span className={`rounded px-1.5 py-0.5 ${isDefined(project, domain) ? 'bg-cyan/10 text-cyan' : 'bg-amber/10 text-amber'}`}>{isDefined(project, domain) ? copy.dict.defined : copy.dict.unresolved}</span>
      </div>
      <Label text={copy.dict.category}>
        <select className="inspector-input py-1.5 text-xs" value={domain.categoryId ?? ''} onChange={(event) => patch({ categoryId: event.target.value || undefined })}>
          <option value="">—</option>
          {Object.values(project.domainCategories).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Label>
      <Label text={copy.description}><textarea className="inspector-input min-h-[48px]" value={domain.description} onChange={(event) => patch({ description: event.target.value }, 'description')} onBlur={onEndBatch} /></Label>
      <Label text={copy.dict.shape}>
        <div className="flex flex-wrap gap-1">
          {DOMAIN_SHAPES.map((shape) => <button key={shape} type="button" className={`rounded-md border px-2 py-1 text-[11px] ${domain.shape === shape ? 'border-cyan bg-cyan/15 text-cyan' : 'border-line text-muted hover:border-muted'}`} onClick={() => setShape(shape)}>{copy.dict.shapes[shape]}</button>)}
        </div>
      </Label>
      {domain.shape === 'single_field' && <Label text={copy.dict.type}><TypeEditor value={domain.type} kinds={PRIMITIVE_KINDS} copy={copy} onChange={(type) => patch({ type })} /></Label>}
      {domain.shape === 'multi_field' && (
        <Section title={copy.dict.components} count={components.length}>
          <div className="rounded-lg border border-line bg-ink/40">
            {components.map((component, index) => (
              <div key={component.id} className="border-b border-line/60 px-2 py-1.5 last:border-b-0">
                <div className="flex items-center gap-1">
                  <input className="min-w-0 flex-1 bg-transparent text-xs outline-none" value={component.name} onChange={(event) => setComponents(components.map((item) => (item.id === component.id ? { ...item, name: event.target.value } : item)), `${component.id}:name`)} onBlur={onEndBatch} />
                  <label className="flex items-center gap-1 text-[10px] text-muted"><input type="checkbox" className="checkbox checkbox-xs" checked={component.required} onChange={(event) => setComponents(components.map((item) => (item.id === component.id ? { ...item, required: event.target.checked } : item)))} />{copy.required}</label>
                  <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 disabled:opacity-30" disabled={index === 0} onClick={() => setComponents(move(components, index, -1))}><Icon name="arrowUp" size={10} /></button>
                  <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 disabled:opacity-30" disabled={index === components.length - 1} onClick={() => setComponents(move(components, index, 1))}><Icon name="arrowDown" size={10} /></button>
                  <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:text-rose-400" onClick={() => setComponents(components.filter((item) => item.id !== component.id))}><Icon name="trash" size={10} /></button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <select className={small} value={component.domainRef ? `d:${component.domainRef}` : 'p'} onChange={(event) => setComponents(components.map((item) => (item.id === component.id ? (event.target.value === 'p' ? { ...item, domainRef: undefined } : { ...item, domainRef: event.target.value.slice(2), type: undefined }) : item)))}>
                    <option value="p">{copy.dict.primitive}</option>
                    {singleDomains.map((other) => <option key={other.id} value={`d:${other.id}`}>{other.name} ({formatType(other.type)})</option>)}
                  </select>
                  {!component.domainRef && <TypeEditor value={component.type} kinds={PRIMITIVE_KINDS} copy={copy} onChange={(type) => setComponents(components.map((item) => (item.id === component.id ? { ...item, type } : item)))} />}
                  {component.domainRef && <span className="font-mono text-[10px] text-muted">{formatType(componentType(project, component))}</span>}
                </div>
              </div>
            ))}
            <div className="px-2 py-1"><QuickEntry className="!border-0 !bg-transparent !px-0 !ring-0" placeholder={copy.dict.addComponent} onSubmit={(name) => setComponents([...components, makeComponent(name)])} /></div>
          </div>
        </Section>
      )}
      {domain.shape === 'code_set' && (
        <Section title={copy.dict.codeSet} count={codeSet.entries.length}>
          <div className="mb-2"><TypeEditor value={codeSet.base} kinds={CODE_SET_BASES} copy={copy} onChange={(base) => base && setCodeSet({ ...codeSet, base })} /></div>
          <div className="rounded-lg border border-line bg-ink/40">
            {codeSet.entries.map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-1 border-b border-line/60 px-2 py-1 last:border-b-0">
                <input className="w-16 rounded bg-ink/60 px-1 py-0.5 font-mono text-[11px] outline-none" placeholder={copy.dict.value} value={entry.value} onChange={(event) => setCodeSet({ ...codeSet, entries: codeSet.entries.map((item) => (item.id === entry.id ? { ...item, value: event.target.value } : item)) }, `${entry.id}:value`)} onBlur={onEndBatch} />
                <input className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder={copy.name} value={entry.name} onChange={(event) => setCodeSet({ ...codeSet, entries: codeSet.entries.map((item) => (item.id === entry.id ? { ...item, name: event.target.value } : item)) }, `${entry.id}:name`)} onBlur={onEndBatch} />
                <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 disabled:opacity-30" disabled={index === 0} onClick={() => setCodeSet({ ...codeSet, entries: move(codeSet.entries, index, -1) })}><Icon name="arrowUp" size={10} /></button>
                <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-white/10 disabled:opacity-30" disabled={index === codeSet.entries.length - 1} onClick={() => setCodeSet({ ...codeSet, entries: move(codeSet.entries, index, 1) })}><Icon name="arrowDown" size={10} /></button>
                <button type="button" className="grid h-5 w-5 place-items-center rounded text-muted hover:text-rose-400" onClick={() => setCodeSet({ ...codeSet, entries: codeSet.entries.filter((item) => item.id !== entry.id) })}><Icon name="trash" size={10} /></button>
              </div>
            ))}
            <div className="px-2 py-1"><QuickEntry className="!border-0 !bg-transparent !px-0 !ring-0" placeholder={copy.dict.addCode} onSubmit={(text) => { const [value, ...rest] = text.split(/[:=]/); setCodeSet({ ...codeSet, entries: [...codeSet.entries, makeCodeSetEntry(rest.join(':').trim() || value.trim(), value.trim())] }) }} /></div>
          </div>
        </Section>
      )}
      {columns.length > 0 && (
        <Section title={copy.dict.columns}>
          <div className="rounded-lg border border-line bg-ink/40 px-2 py-1 font-mono text-[11px]">
            {columns.map((column) => <div key={column.componentId ?? column.name} className="flex justify-between gap-2"><span className="truncate">{column.name}</span><span className={column.type ? 'text-muted' : 'text-amber/80'}>{column.type ?? copy.dict.unresolved}</span></div>)}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-muted">{copy.dict.columnsHint(usage[0] ? `${usage[0].entity.name}.${attributeName(project, usage[0].attribute)}` : '')}</p>
        </Section>
      )}
      <Section title={copy.dict.usedBy} count={usage.length}>
        {usage.map(({ entity, attribute }) => <button key={attribute.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-base-content" onClick={() => onReveal({ kind: 'element', id: entity.id })}><Icon name="table" size={11} className="shrink-0" /><span className="truncate">{entity.name}.<span className="text-base-content">{attributeName(project, attribute)}</span></span></button>)}
        {!usage.length && <p className="px-2 text-[10px] text-muted">{copy.dict.unused}</p>}
      </Section>
      <button type="button" className="btn btn-ghost btn-sm w-full justify-start text-rose-400 hover:bg-rose-500/10 disabled:opacity-40" disabled={usage.length > 0} title={usage.length ? copy.dict.deleteDomainUsed : undefined} onClick={() => { commit((current) => deleteDomain(current, domain.id)); onNavigate('domains') }}><Icon name="trash" size={14} />{copy.dict.deleteDomain}</button>
    </div>
  )
}

import type { Indicator } from '../core/vocabulary'
import { bindName, mentionedEntries, unmatchedWords } from '../core/vocabulary'
import type { Project, VocabularyEntry } from '../core/model'
import type { Copy } from './i18n'
import { Icon } from './icons'

export const INDICATOR_STYLE: Record<Indicator, string> = {
  unregistered: 'bg-rose-400',
  alias_match: 'bg-amber',
  missing_system_name: 'bg-violet',
  missing_physical_name: 'bg-violet',
  complete: 'bg-emerald-400',
}

function entryCard(copy: Copy, entry: VocabularyEntry) {
  return [`${copy.dict.businessName}: ${entry.businessName}`, `${copy.dict.systemName}: ${entry.systemName || '—'}`, `${copy.dict.physicalName}: ${entry.physicalName || '—'}`, entry.meaning].filter(Boolean).join('\n')
}

/** A small dot showing a bound name's most severe vocabulary indicator; nothing while the project has no vocabulary. */
export function IndicatorDot({ project, name, plural = false, copy }: { project: Project; name: string; plural?: boolean; copy: Copy }) {
  if (!Object.keys(project.vocabulary).length || !name.trim()) return null
  const indicator = bindName(project, name, plural).indicators[0]
  if (indicator === 'complete') return null
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${INDICATOR_STYLE[indicator]}`} title={copy.dict.indicators[indicator]} />
}

/**
 * The vocabulary binding of one name (data:vocabulary-binding): matched terms open their entry, unmatched words
 * register as entries with one click, and the derived system and physical names show with what is missing.
 */
export function BindingLine({ project, name, plural = false, copy, onOpenEntry, onRegister }: { project: Project; name: string; plural?: boolean; copy: Copy; onOpenEntry: (entryId: string) => void; onRegister: (word: string) => void }) {
  if (!name.trim()) return null
  const binding = bindName(project, name, plural)
  const words = new Set(unmatchedWords(binding).map((word) => word.toLowerCase()))
  return (
    <div className="mb-3 rounded-lg border border-line/70 bg-ink/30 px-2 py-1.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-1">
        {binding.segments.map((item, index) => {
          if (item.kind === 'separator') return null
          if (item.kind === 'match') {
            const entry = project.vocabulary[item.entryId]
            return <button key={index} type="button" className={`rounded px-1.5 py-0.5 ${item.match === 'alias' ? 'bg-amber/15 text-amber' : 'bg-cyan/10 text-cyan'} hover:underline`} title={`${entry ? entryCard(copy, entry) : ''}${item.match === 'alias' ? `\n${copy.dict.indicators.alias_match}` : ''}`} onClick={() => onOpenEntry(item.entryId)}>{item.text}</button>
          }
          if (/^\d+$/.test(item.text)) return <span key={index} className="text-muted">{item.text}</span>
          return item.text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-./・]+/).filter(Boolean).map((word, part) => (
            words.has(word.toLowerCase().replace(/\d+$/, '')) || words.has(word.toLowerCase())
              ? <button key={`${index}-${part}`} type="button" className="flex items-center gap-0.5 rounded border border-dashed border-rose-400/60 px-1 py-0.5 text-rose-200 hover:border-cyan hover:text-cyan" title={copy.dict.registerWord} onClick={() => onRegister(word.replace(/\d+$/, ''))}><Icon name="plus" size={9} />{word}</button>
              : <span key={`${index}-${part}`} className="text-muted">{word}</span>
          ))
        })}
      </div>
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-[10px] text-muted">
        <span>{copy.dict.systemName}</span><span className={binding.unmatched.length || binding.missingSystem.length ? 'text-amber/90' : 'text-base-content'}>{binding.segments.some((item) => item.kind === 'match') ? binding.system : '—'}</span>
        <span>{copy.dict.physicalName}</span><span className={`font-mono ${binding.physical ? 'text-base-content' : 'text-amber/90'}`}>{binding.physical ?? (binding.unmatched.length ? copy.dict.physicalBlocked : copy.dict.physicalMissing)}</span>
      </div>
    </div>
  )
}

/** Registered terms mentioned in free text, as links with a hover card; read-only (decision: vocabulary-binding-scope). */
export function TermChips({ project, texts, copy, onOpenEntry }: { project: Project; texts: string[]; copy: Copy; onOpenEntry: (entryId: string) => void }) {
  if (!Object.keys(project.vocabulary).length) return null
  const ids = [...new Set(texts.flatMap((text) => mentionedEntries(project, text)))]
  if (!ids.length) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted">{copy.dict.terms}</span>
      {ids.map((id) => {
        const entry = project.vocabulary[id]
        if (!entry) return null
        return <button key={id} type="button" className="rounded bg-cyan/10 px-1.5 py-0.5 text-[11px] text-cyan hover:underline" title={entryCard(copy, entry)} onClick={() => onOpenEntry(id)}>{entry.businessName}</button>
      })}
    </div>
  )
}

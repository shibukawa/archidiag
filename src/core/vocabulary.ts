// Vocabulary resolution (rule: vocabulary-resolution) and name derivation (data:vocabulary-binding). No DOM here.
import { makeId, type Attribute, type DataDomain, type Element, type IdentifierCase, type NameMode, type NamingPolicy, type Project, type VocabularyEntry } from './model'

export type MatchKind = 'preferred' | 'alias'

export type Segment =
  | { kind: 'match'; entryId: string; text: string; match: MatchKind }
  | { kind: 'text'; text: string }
  | { kind: 'separator'; text: string }

export type Indicator = 'unregistered' | 'alias_match' | 'missing_system_name' | 'missing_physical_name' | 'complete'

export interface Binding {
  source: string
  segments: Segment[]
  business: string
  system: string
  /** Undefined while any text is unmatched or a matched entry lacks a physical name. */
  physical?: string
  unmatched: string[]
  /** Entry ids matched without a system or physical name. */
  missingSystem: string[]
  missingPhysical: string[]
  aliasEntries: string[]
  /** Most severe first; ['complete'] when nothing is flagged. */
  indicators: Indicator[]
}

/** key is the lower-cased term without separators, so created_at, created at, and CreatedAt all match it. */
interface Term { key: string; entryId: string; match: MatchKind; boundedStart: boolean; boundedEnd: boolean }
interface TermIndex { terms: Term[]; duplicates: string[] }

const SEPARATOR = /[\s_\-./・]/
const CJK = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/
const ALNUM = /[A-Za-z0-9]/

const isCjk = (char: string | undefined) => Boolean(char && CJK.test(char))
const isAlnum = (char: string | undefined) => Boolean(char && ALNUM.test(char))
const isUpper = (char: string | undefined) => Boolean(char && /[A-Z]/.test(char))
const isLower = (char: string | undefined) => Boolean(char && /[a-z]/.test(char))
const isDigit = (char: string | undefined) => Boolean(char && /[0-9]/.test(char))

/** A word boundary for latin text: separators, script changes, digits, and camelCase humps. */
function boundaryAt(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return true
  const before = text[index - 1]
  const after = text[index]
  if (!isAlnum(before) || !isAlnum(after)) return true
  if (isDigit(before) !== isDigit(after)) return true
  if (isLower(before) && isUpper(after)) return true
  return isUpper(before) && isUpper(after) && isLower(text[index + 1])
}

const indexCache = new WeakMap<Record<string, VocabularyEntry>, TermIndex>()

/** Lookup terms longest first; terms shared by two entries are duplicates and never auto-selected. */
export function termIndex(vocabulary: Record<string, VocabularyEntry>): TermIndex {
  const cached = indexCache.get(vocabulary)
  if (cached) return cached
  const owners = new Map<string, Set<string>>()
  const raw: Array<{ text: string; key: string; entryId: string; match: MatchKind }> = []
  Object.values(vocabulary).forEach((entry) => {
    const terms: Array<[string, MatchKind]> = [[entry.businessName, 'preferred'], ...entry.aliases.map((alias) => [alias, 'alias'] as [string, MatchKind])]
    terms.forEach(([text, match]) => {
      const trimmed = text.trim()
      const key = termKey(trimmed)
      if (!key) return
      owners.set(key, (owners.get(key) ?? new Set()).add(entry.id))
      raw.push({ text: trimmed, key, entryId: entry.id, match })
    })
  })
  const duplicateKeys = [...owners.entries()].filter(([, ids]) => ids.size > 1).map(([key]) => key)
  const excluded = new Set(duplicateKeys)
  const seen = new Set<string>()
  const terms = raw
    .filter((term) => !excluded.has(term.key))
    // An entry listing its business name again as an alias keeps the preferred match.
    .sort((a, b) => b.key.length - a.key.length || (a.match === 'preferred' ? -1 : 1) - (b.match === 'preferred' ? -1 : 1))
    .filter((term) => { const id = `${term.entryId}:${term.key}`; if (seen.has(id)) return false; seen.add(id); return true })
    .map((term) => ({ key: term.key, entryId: term.entryId, match: term.match, boundedStart: isAlnum(term.key[0]), boundedEnd: isAlnum(term.key[term.key.length - 1]) }))
  const duplicates = raw.filter((term) => excluded.has(term.key)).map((term) => term.text.toLowerCase()).filter((text, position, all) => all.indexOf(text) === position)
  const index = { terms, duplicates }
  indexCache.set(vocabulary, index)
  return index
}

/** Lower case per UTF-16 unit, keeping the length so positions line up with the source (İ lowers to two units). */
function lowerSameLength(text: string): string {
  return text.split('').map((char) => { const lower = char.toLowerCase(); return lower.length === 1 ? lower : char }).join('')
}

export function termKey(text: string): string {
  return [...lowerSameLength(text)].filter((char) => !SEPARATOR.test(char)).join('')
}

/** The end of a match of key at start, skipping separators inside the source text, or -1. */
function matchEnd(lowerSource: string, start: number, key: string): number {
  let position = start
  let matched = 0
  while (matched < key.length) {
    if (position >= lowerSource.length) return -1
    const char = lowerSource[position]
    if (matched > 0 && SEPARATOR.test(char)) { position += 1; continue }
    if (char !== key[matched]) return -1
    position += 1
    matched += 1
  }
  return position
}

/** Splits text into matched entries, unmatched text, and separators; longest match wins, preferred over alias at equal length. */
export function segment(vocabulary: Record<string, VocabularyEntry>, source: string): Segment[] {
  const { terms } = termIndex(vocabulary)
  const lowerSource = lowerSameLength(source)
  const segments: Segment[] = []
  const push = (kind: 'text' | 'separator', char: string) => {
    const last = segments[segments.length - 1]
    if (last && last.kind === kind) last.text += char
    else segments.push({ kind, text: char })
  }
  let index = 0
  while (index < source.length) {
    let end = -1
    const hit = terms.find((term) => {
      if (term.boundedStart && !boundaryAt(source, index)) return false
      end = matchEnd(lowerSource, index, term.key)
      return end > 0 && (!term.boundedEnd || boundaryAt(source, end))
    })
    if (hit) {
      segments.push({ kind: 'match', entryId: hit.entryId, text: source.slice(index, end), match: hit.match })
      index = end
      continue
    }
    const char = source[index]
    push(SEPARATOR.test(char) ? 'separator' : 'text', char)
    index += 1
  }
  return segments
}

/** Joins label pieces, spacing latin words apart and running CJK text together. */
function joinPieces(pieces: string[]): string {
  let result = ''
  pieces.forEach((piece) => {
    if (!piece) return
    if (result && !isCjk(result[result.length - 1]) && !isCjk(piece[0])) result += ' '
    result += piece
  })
  return result
}

export function toWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-./]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
}

export function formatIdentifier(words: string[], identifierCase: IdentifierCase): string {
  if (!words.length) return ''
  if (identifierCase === 'snake_case') return words.join('_')
  const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
  if (identifierCase === 'PascalCase') return words.map(capital).join('')
  return words[0] + words.slice(1).map(capital).join('')
}

export function matchesCase(name: string, identifierCase: IdentifierCase): boolean {
  return formatIdentifier(toWords(name), identifierCase) === name
}

const bindingCache = new WeakMap<Record<string, VocabularyEntry>, Map<string, Binding>>()

/** The binding of one name. Cached per vocabulary object, so rendering reads it without rematching. */
export function bindName(project: Pick<Project, 'vocabulary' | 'settings'>, source: string, plural = false): Binding {
  const policy = project.settings.namingPolicy
  const key = `${plural ? 'p' : 's'}:${policy.identifierCase}:${source}`
  let cache = bindingCache.get(project.vocabulary)
  if (!cache) { cache = new Map(); bindingCache.set(project.vocabulary, cache) }
  const cached = cache.get(key)
  if (cached) return cached
  const binding = computeBinding(project.vocabulary, policy, source, plural)
  cache.set(key, binding)
  return binding
}

function computeBinding(vocabulary: Record<string, VocabularyEntry>, policy: NamingPolicy, source: string, plural: boolean): Binding {
  const segments = segment(vocabulary, source)
  const unmatched: string[] = []
  const missingSystem: string[] = []
  const missingPhysical: string[] = []
  const aliasEntries: string[] = []
  const systemPieces: string[] = []
  const physicalWords: string[] = []
  let business = ''
  let physicalComplete = true
  const lastMatch = segments.reduce((last, item, position) => (item.kind === 'match' ? position : last), -1)
  segments.forEach((item, position) => {
    if (item.kind === 'separator') { business += item.text; return }
    // A bare number (line1, address2) is a literal suffix: kept in every form, never a term to register.
    if (item.kind === 'text' && /^\d+$/.test(item.text)) {
      business += item.text
      systemPieces.push(item.text)
      if (physicalWords.length && segments[position - 1]?.kind !== 'separator') physicalWords[physicalWords.length - 1] += item.text
      else physicalWords.push(item.text)
      return
    }
    if (item.kind === 'text') {
      business += item.text
      systemPieces.push(item.text)
      unmatched.push(item.text)
      physicalComplete = false
      return
    }
    const entry = vocabulary[item.entryId]
    business += entry.businessName
    if (item.match === 'alias') aliasEntries.push(entry.id)
    if (entry.systemName.trim()) systemPieces.push(entry.systemName.trim())
    else { systemPieces.push(item.text); missingSystem.push(entry.id) }
    const physical = plural && position === lastMatch ? entry.physicalNamePlural?.trim() : entry.physicalName.trim()
    if (physical) physicalWords.push(...toWords(physical))
    else { missingPhysical.push(entry.id); physicalComplete = false }
  })
  const indicators: Indicator[] = []
  if (unmatched.length) indicators.push('unregistered')
  if (aliasEntries.length) indicators.push('alias_match')
  if (missingSystem.length) indicators.push('missing_system_name')
  if (missingPhysical.length) indicators.push('missing_physical_name')
  if (!indicators.length) indicators.push('complete')
  return {
    source,
    segments,
    business,
    system: joinPieces(systemPieces),
    physical: physicalComplete && physicalWords.length ? formatIdentifier(physicalWords, policy.identifierCase) : undefined,
    unmatched,
    missingSystem,
    missingPhysical,
    aliasEntries,
    indicators,
  }
}

/** A label in the requested form; a missing form falls back to the name as typed and says so. */
export function displayName(project: Pick<Project, 'vocabulary' | 'settings'>, source: string, mode: NameMode, plural = false): { text: string; missing: boolean } {
  if (mode === 'business' || !source.trim()) return { text: source, missing: false }
  const binding = bindName(project, source, plural)
  const systemMissing = binding.unmatched.length > 0 || binding.missingSystem.length > 0
  const system = binding.segments.some((item) => item.kind === 'match') ? binding.system : source
  if (mode === 'system') return { text: system, missing: systemMissing }
  if (mode === 'physical') return { text: binding.physical ?? source, missing: !binding.physical }
  return { text: binding.physical ? `${system} (${binding.physical})` : system, missing: systemMissing || !binding.physical }
}

/** Registered terms found in free text; read-only, never a binding or a finding (decision: vocabulary-binding-scope). */
export function mentionedEntries(project: Pick<Project, 'vocabulary'>, text: string): string[] {
  if (!text.trim()) return []
  return [...new Set(segment(project.vocabulary, text).flatMap((item) => (item.kind === 'match' ? [item.entryId] : [])))]
}

/** Unmatched words of a name, split on separators, script changes, and camelCase humps, ready to register. */
export function unmatchedWords(binding: Binding): string[] {
  return [...new Set(binding.unmatched.flatMap((text) => text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/(\D)(\d+)$/, '$1').split(/[\s_\-./・]+/)).map((word) => word.trim()).filter((word) => word && !/^\d+$/.test(word)))]
}

// ---------- owners and usage ----------

export type OwnerRef =
  | { ownerKind: 'entity'; elementId: string }
  | { ownerKind: 'attribute'; elementId: string; attributeId: string }
  | { ownerKind: 'domain'; domainId: string }
  | { ownerKind: 'element'; elementId: string }

export interface BoundOwner { ref: OwnerRef; name: string; plural: boolean; label: string }

/** Effective attribute name: name + domain name when the attribute opts into the domain name (data:attribute use_domain_name). */
export function attributeName(project: Pick<Project, 'domains'>, attribute: Attribute): string {
  if (!attribute.useDomainName) return attribute.name
  const domain = attribute.domainId ? project.domains[attribute.domainId] : undefined
  return `${attribute.name}${domain?.name ?? ''}`
}

/** Names whose vocabulary binding is required (entities, attributes, domains) or opted into (C4 elements). */
export function boundOwners(project: Project): BoundOwner[] {
  const owners: BoundOwner[] = []
  const plural = project.settings.namingPolicy.tableNumber === 'plural'
  Object.values(project.elements).forEach((element) => {
    if (element.kind === 'entity') {
      owners.push({ ref: { ownerKind: 'entity', elementId: element.id }, name: element.name, plural, label: element.name })
      ;(element.attributes ?? []).forEach((attribute) => owners.push({ ref: { ownerKind: 'attribute', elementId: element.id, attributeId: attribute.id }, name: attributeName(project, attribute), plural: false, label: `${element.name}.${attributeName(project, attribute)}` }))
    } else if (element.vocabularyBound) owners.push({ ref: { ownerKind: 'element', elementId: element.id }, name: element.name, plural: false, label: element.name })
  })
  Object.values(project.domains).forEach((domain) => owners.push({ ref: { ownerKind: 'domain', domainId: domain.id }, name: domain.name, plural: false, label: domain.name }))
  return owners
}

export type MentionRef =
  | { mentionKind: 'element'; elementId: string; field: 'name' | 'description' }
  | { mentionKind: 'relationship'; relationshipId: string }
  | { mentionKind: 'flow'; viewId: string; flowId: string }

export interface VocabularyUsage { bindings: BoundOwner[]; mentions: Array<{ ref: MentionRef; label: string }> }

/** Bindings and passive mentions of every entry, listed separately (data:vocabulary-entry usage). */
export function vocabularyUsage(project: Project): Map<string, VocabularyUsage> {
  const usage = new Map<string, VocabularyUsage>(Object.keys(project.vocabulary).map((id) => [id, { bindings: [], mentions: [] }]))
  boundOwners(project).forEach((owner) => {
    const ids = new Set(bindName(project, owner.name, owner.plural).segments.flatMap((item) => (item.kind === 'match' ? [item.entryId] : [])))
    ids.forEach((id) => usage.get(id)?.bindings.push(owner))
  })
  const mention = (text: string, ref: MentionRef, label: string) => mentionedEntries(project, text).forEach((id) => usage.get(id)?.mentions.push({ ref, label }))
  Object.values(project.elements).forEach((element) => {
    if (element.kind !== 'entity' && !element.vocabularyBound) mention(element.name, { mentionKind: 'element', elementId: element.id, field: 'name' }, element.name)
    mention(element.description, { mentionKind: 'element', elementId: element.id, field: 'description' }, element.name)
  })
  Object.values(project.relationships).forEach((relationship) => mention(relationship.label, { mentionKind: 'relationship', relationshipId: relationship.id }, relationship.label))
  Object.values(project.views).forEach((view) => Object.values(view.dfd?.flows ?? {}).forEach((flow) => mention(flow.label, { mentionKind: 'flow', viewId: view.id, flowId: flow.id }, `${view.useCase || view.name}: ${flow.label}`)))
  return usage
}

/** Unmatched words across bound names with how often each occurs, most frequent first. */
export function unregisteredWords(project: Project): Array<{ word: string; count: number; owners: BoundOwner[] }> {
  const words = new Map<string, { word: string; count: number; owners: BoundOwner[] }>()
  boundOwners(project).forEach((owner) => {
    unmatchedWords(bindName(project, owner.name, owner.plural)).forEach((word) => {
      const key = word.toLowerCase()
      const current = words.get(key) ?? { word, count: 0, owners: [] }
      current.count += 1
      current.owners.push(owner)
      words.set(key, current)
    })
  })
  return [...words.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
}

export const MISSING_NAME_MARK = '⚠'

const displayCache = new WeakMap<Project, Map<NameMode, Project>>()

/**
 * The project as a diagram shows it in a name mode: entity, field, domain, and opted-in C4 names replaced by their
 * derived form, a missing form marked. Presentation only; ids and everything else stay (requirement: name-display-switching).
 */
export function displayProject(project: Project, mode: NameMode | undefined): Project {
  if (!mode || mode === 'business' || !Object.keys(project.vocabulary).length) return project
  let cache = displayCache.get(project)
  if (!cache) { cache = new Map(); displayCache.set(project, cache) }
  const cached = cache.get(mode)
  if (cached) return cached
  const plural = project.settings.namingPolicy.tableNumber === 'plural'
  const shown = (name: string, asTable = false) => {
    const result = displayName(project, name, mode, asTable && plural)
    return result.missing ? `${result.text} ${MISSING_NAME_MARK}` : result.text
  }
  const elements = Object.fromEntries(Object.entries(project.elements).map(([id, element]): [string, Element] => {
    if (element.kind === 'entity') return [id, { ...element, name: shown(element.name, true), attributes: element.attributes?.map((attribute) => ({ ...attribute, name: shown(attributeName(project, attribute)), useDomainName: undefined })) }]
    return [id, element.vocabularyBound ? { ...element, name: shown(element.name) } : element]
  }))
  const domains = Object.fromEntries(Object.entries(project.domains).map(([id, domain]): [string, DataDomain] => [id, { ...domain, name: shown(domain.name) }]))
  const display = { ...project, elements, domains }
  cache.set(mode, display)
  return display
}

// ---------- commands ----------

export function makeEntry(businessName: string, patch: Partial<VocabularyEntry> = {}): VocabularyEntry {
  return { id: makeId('term'), businessName, systemName: '', physicalName: '', meaning: '', notes: '', aliases: [], ...patch }
}

export function findEntryByTerm(project: Pick<Project, 'vocabulary'>, term: string): VocabularyEntry | undefined {
  const lower = term.trim().toLowerCase()
  return Object.values(project.vocabulary).find((entry) => entry.businessName.trim().toLowerCase() === lower || entry.aliases.some((alias) => alias.trim().toLowerCase() === lower))
}

export function addEntry(project: Project, businessName: string, patch: Partial<VocabularyEntry> = {}): { project: Project; entry: VocabularyEntry } {
  const entry = makeEntry(businessName.trim(), patch)
  return { project: { ...project, vocabulary: { ...project.vocabulary, [entry.id]: entry } }, entry }
}

export function patchEntry(project: Project, id: string, patch: Partial<VocabularyEntry>): Project {
  const current = project.vocabulary[id]
  if (!current) return project
  return { ...project, vocabulary: { ...project.vocabulary, [id]: { ...current, ...patch, id } } }
}

export function deleteEntry(project: Project, id: string): Project {
  const vocabulary = { ...project.vocabulary }
  delete vocabulary[id]
  return { ...project, vocabulary }
}

/** The entry that already owns a term equal to the name after normalization, other than the given entry. */
export function conflictingEntry(project: Pick<Project, 'vocabulary'>, id: string, name: string): VocabularyEntry | undefined {
  const key = termKey(name)
  return Object.values(project.vocabulary).find((entry) => entry.id !== id && [entry.businessName, ...entry.aliases].some((term) => termKey(term) === key))
}

/**
 * Renames an entry's business name and rewrites every bound name that used it, so labels follow the entry.
 * Alias matches and free-text mentions are left as typed. A name another entry already owns is refused.
 */
export function renameEntry(project: Project, id: string, businessName: string): Project {
  const entry = project.vocabulary[id]
  const next = businessName.trim()
  if (!entry || !next || next === entry.businessName || conflictingEntry(project, id, next)) return project
  // The replacement follows how the name was typed: customer_id stays snake case, OrderLine Pascal, CUSTOMER upper,
  // while a name with spaces (Order Line) takes the new business name as written.
  const styled = (typed: string, whole: string) => {
    if (/\s/.test(whole) || !/[A-Za-z]/.test(next)) return typed === entry.businessName ? next : typed === typed.toUpperCase() && typed !== typed.toLowerCase() ? next.toUpperCase() : next
    const words = toWords(next)
    if (!words.length) return next
    // A name that is just this term takes the new business name as written, or its lower-case snake form.
    if (whole.trim() === typed) return typed === entry.businessName ? next : typed === typed.toLowerCase() ? words.join('_') : next
    if (typed === typed.toUpperCase() && typed !== typed.toLowerCase()) return words.join(/[-]/.test(whole) ? '-' : '_').toUpperCase()
    if (/[_-]/.test(whole)) return words.join(whole.includes('-') ? '-' : '_')
    return /^[A-Z]/.test(typed) ? formatIdentifier(words, 'PascalCase') : formatIdentifier(words, 'camelCase')
  }
  const rewrite = (name: string) => {
    const segments = segment(project.vocabulary, name)
    if (!segments.some((item) => item.kind === 'match' && item.entryId === id && item.match === 'preferred')) return name
    return segments.map((item) => (item.kind === 'match' && item.entryId === id && item.match === 'preferred' ? styled(item.text, name) : item.text)).join('')
  }
  const elements = Object.fromEntries(Object.entries(project.elements).map(([elementId, element]): [string, Element] => {
    if (element.kind === 'entity') return [elementId, { ...element, name: rewrite(element.name), attributes: element.attributes?.map((attribute) => ({ ...attribute, name: rewrite(attribute.name) })) }]
    return [elementId, element.vocabularyBound ? { ...element, name: rewrite(element.name) } : element]
  }))
  const domains = Object.fromEntries(Object.entries(project.domains).map(([domainId, domain]): [string, DataDomain] => [domainId, { ...domain, name: rewrite(domain.name) }]))
  return { ...project, elements, domains, vocabulary: { ...project.vocabulary, [id]: { ...entry, businessName: next } } }
}

/** Physical names derived from ASCII system names under the policy's case, for entries that have none yet. */
export function derivePhysicalNames(project: Project): { project: Project; count: number } {
  let count = 0
  const vocabulary = Object.fromEntries(Object.entries(project.vocabulary).map(([id, entry]) => {
    if (entry.physicalName.trim() || !/^[\x20-\x7e]+$/.test(entry.systemName.trim())) return [id, entry]
    const physicalName = formatIdentifier(toWords(entry.systemName), project.settings.namingPolicy.identifierCase)
    if (!physicalName) return [id, entry]
    count += 1
    return [id, { ...entry, physicalName }]
  }))
  return { project: count ? { ...project, vocabulary } : project, count }
}

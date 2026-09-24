// Name suggestions for vocabulary entries (requirement: name-suggestion). Candidates are transient and never
// confirmed without the author: reuse and composition from confirmed entries come first, then the local providers.
import type { Project, VocabularyEntry } from './model'
import { formatIdentifier, segment, toWords } from './vocabulary'

export type SuggestionTarget = 'system_name' | 'physical_name'
export type ResolutionKind = 'reuse_existing_entry' | 'composed_from_segments' | 'same_language' | 'transliterated' | 'translated'

export interface NameSuggestion {
  entryId: string
  target: SuggestionTarget
  value: string
  provider: string
  resolution: ResolutionKind
  rationale: string
}

/** Reuse and composition are safe to accept in bulk; provider output needs a look. */
export const SAFE_RESOLUTIONS: ResolutionKind[] = ['reuse_existing_entry', 'composed_from_segments']

const CJK = /[぀-ヿ㐀-鿿]/
const KANA_ONLY = /^[぀-ヿー・\s]+$/

// ---------- romaji (rule: physical-naming-policy transliteration) ----------

const BASE: Record<string, [string, string]> = {
  あ: ['a', 'a'], い: ['i', 'i'], う: ['u', 'u'], え: ['e', 'e'], お: ['o', 'o'],
  か: ['ka', 'ka'], き: ['ki', 'ki'], く: ['ku', 'ku'], け: ['ke', 'ke'], こ: ['ko', 'ko'],
  さ: ['sa', 'sa'], し: ['shi', 'si'], す: ['su', 'su'], せ: ['se', 'se'], そ: ['so', 'so'],
  た: ['ta', 'ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te', 'te'], と: ['to', 'to'],
  な: ['na', 'na'], に: ['ni', 'ni'], ぬ: ['nu', 'nu'], ね: ['ne', 'ne'], の: ['no', 'no'],
  は: ['ha', 'ha'], ひ: ['hi', 'hi'], ふ: ['fu', 'hu'], へ: ['he', 'he'], ほ: ['ho', 'ho'],
  ま: ['ma', 'ma'], み: ['mi', 'mi'], む: ['mu', 'mu'], め: ['me', 'me'], も: ['mo', 'mo'],
  や: ['ya', 'ya'], ゆ: ['yu', 'yu'], よ: ['yo', 'yo'],
  ら: ['ra', 'ra'], り: ['ri', 'ri'], る: ['ru', 'ru'], れ: ['re', 're'], ろ: ['ro', 'ro'],
  わ: ['wa', 'wa'], ゐ: ['i', 'i'], ゑ: ['e', 'e'], を: ['o', 'o'], ん: ['n', 'n'],
  が: ['ga', 'ga'], ぎ: ['gi', 'gi'], ぐ: ['gu', 'gu'], げ: ['ge', 'ge'], ご: ['go', 'go'],
  ざ: ['za', 'za'], じ: ['ji', 'zi'], ず: ['zu', 'zu'], ぜ: ['ze', 'ze'], ぞ: ['zo', 'zo'],
  だ: ['da', 'da'], ぢ: ['ji', 'zi'], づ: ['zu', 'zu'], で: ['de', 'de'], ど: ['do', 'do'],
  ば: ['ba', 'ba'], び: ['bi', 'bi'], ぶ: ['bu', 'bu'], べ: ['be', 'be'], ぼ: ['bo', 'bo'],
  ぱ: ['pa', 'pa'], ぴ: ['pi', 'pi'], ぷ: ['pu', 'pu'], ぺ: ['pe', 'pe'], ぽ: ['po', 'po'],
  ゔ: ['vu', 'vu'], ぁ: ['a', 'a'], ぃ: ['i', 'i'], ぅ: ['u', 'u'], ぇ: ['e', 'e'], ぉ: ['o', 'o'],
}
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' }
/** Foreign-sound digraphs written with a small vowel, as in katakana loanwords (ファ, ティ, ウェ). */
const SMALL_VOWEL: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' }

/** Onsets of loanword digraphs, so ファ is fa and ウェ we in both styles; Kunrei spells チェ tye and ジェ zye. */
const LOANWORD_ONSET: Record<string, [string, string]> = { ふ: ['f', 'f'], う: ['w', 'w'], ち: ['ch', 'ty'], じ: ['j', 'zy'], し: ['sh', 'sy'], ゔ: ['v', 'v'], て: ['t', 't'], で: ['d', 'd'], と: ['t', 't'], ど: ['d', 'd'] }

function toHiragana(text: string): string {
  return [...text].map((char) => { const code = char.charCodeAt(0); return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char }).join('')
}

/** Deterministic romaji for kana text: Hepburn or Kunrei, long vowels doubled, sokuon doubling the next consonant. */
export function romanize(text: string, style: 'hepburn' | 'kunrei'): string {
  const chars = [...toHiragana(text)]
  const column = style === 'hepburn' ? 0 : 1
  let out = ''
  let geminate = false
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index]
    const next = chars[index + 1]
    if (char === 'っ') { geminate = true; continue }
    if (char === 'ー') { const vowel = out.match(/[aeiou]$/)?.[0]; if (vowel) out += vowel; continue }
    let syllable = BASE[char]?.[column]
    if (!syllable) { out += /[\s・]/.test(char) ? ' ' : char; geminate = false; continue }
    if (next && SMALL_Y[next] && syllable.endsWith('i') && char !== 'い') {
      const stem = syllable.slice(0, -1)
      syllable = style === 'hepburn' && /^(sh|ch|j)$/.test(stem) ? `${stem}${SMALL_Y[next]}` : `${stem}y${SMALL_Y[next]}`
      index += 1
    } else if (next && SMALL_VOWEL[next] && !SMALL_VOWEL[char]) {
      syllable = `${LOANWORD_ONSET[char]?.[column] ?? (syllable.replace(/[aeiou]$/, '') || syllable)}${SMALL_VOWEL[next]}`
      index += 1
    }
    if (geminate) { out += syllable.startsWith('ch') ? 't' : syllable[0]; geminate = false }
    out += syllable
  }
  return out.trim()
}

// ---------- local suggestions ----------

function titleWords(text: string): string {
  return toWords(text).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/**
 * Candidates for one entry's missing names without any network: reuse or composition from the other confirmed
 * entries, the same words when the business name is already latin, and romaji for kana under a romaji policy.
 */
export function localSuggestions(project: Project, entry: VocabularyEntry): NameSuggestion[] {
  const out: NameSuggestion[] = []
  const policy = project.settings.namingPolicy
  const wantSystem = !entry.systemName.trim()
  const wantPhysical = !entry.physicalName.trim()
  if (!wantSystem && !wantPhysical) return out
  const add = (target: SuggestionTarget, value: string, provider: string, resolution: ResolutionKind, rationale: string) => {
    if (!value.trim() || out.some((item) => item.target === target && item.value === value)) return
    if ((target === 'system_name' && !wantSystem) || (target === 'physical_name' && !wantPhysical)) return
    out.push({ entryId: entry.id, target, value, provider, resolution, rationale })
  }
  const others = Object.fromEntries(Object.entries(project.vocabulary).filter(([id]) => id !== entry.id))
  const parts = segment(others, entry.businessName).filter((item) => item.kind !== 'separator')
  const matched = parts.filter((item) => item.kind === 'match')
  const covered = parts.every((item) => item.kind === 'match' || /^\d+$/.test(item.text))
  if (matched.length && covered) {
    const entries = matched.map((item) => others[item.kind === 'match' ? item.entryId : ''])
    const resolution: ResolutionKind = matched.length === 1 && parts.length === 1 ? 'reuse_existing_entry' : 'composed_from_segments'
    const from = entries.map((other) => other.businessName).join(' + ')
    if (entries.every((other) => other.systemName.trim())) {
      const pieces = parts.map((item) => (item.kind === 'match' ? others[item.entryId].systemName.trim() : item.text))
      add('system_name', pieces.reduce((text, piece) => (text && !CJK.test(text[text.length - 1]) && !CJK.test(piece[0]) ? `${text} ${piece}` : text + piece), ''), 'vocabulary', resolution, from)
    }
    if (entries.every((other) => other.physicalName.trim())) {
      const words = parts.flatMap((item) => (item.kind === 'match' ? toWords(others[item.entryId].physicalName) : [item.text]))
      add('physical_name', formatIdentifier(words, policy.identifierCase), 'vocabulary', resolution, from)
    }
  }
  if (/^[\x20-\x7e]+$/.test(entry.businessName)) {
    add('system_name', titleWords(entry.businessName), 'same language', 'same_language', entry.businessName)
    add('physical_name', formatIdentifier(toWords(entry.businessName), policy.identifierCase), 'same language', 'same_language', entry.businessName)
  } else if (policy.transliteration !== 'translate' && KANA_ONLY.test(entry.businessName)) {
    const style = policy.transliteration === 'romaji_kunrei' ? 'kunrei' : 'hepburn'
    add('physical_name', formatIdentifier(toWords(romanize(entry.businessName, style)), policy.identifierCase), `romaji (${style})`, 'transliterated', entry.businessName)
  }
  // With a latin system name already confirmed, the physical name follows it in the policy case.
  if (wantPhysical && !wantSystem && /^[\x20-\x7e]+$/.test(entry.systemName)) add('physical_name', formatIdentifier(toWords(entry.systemName), policy.identifierCase), 'system name', 'same_language', entry.systemName)
  return out
}

/** Candidates from a translated system name, for a provider that translated the business name. */
export function fromTranslation(project: Project, entry: VocabularyEntry, translated: string, provider: string): NameSuggestion[] {
  const clean = translated.replace(/[.。]$/, '').trim()
  if (!clean) return []
  const out: NameSuggestion[] = []
  if (!entry.systemName.trim()) out.push({ entryId: entry.id, target: 'system_name', value: titleWords(clean) || clean, provider, resolution: 'translated', rationale: `${entry.businessName} → ${clean}` })
  const physical = formatIdentifier(toWords(clean.normalize('NFKD').replace(/[^\x20-\x7e]/g, '')), project.settings.namingPolicy.identifierCase)
  if (!entry.physicalName.trim() && physical) out.push({ entryId: entry.id, target: 'physical_name', value: physical, provider, resolution: 'translated', rationale: `${entry.businessName} → ${clean}` })
  return out
}

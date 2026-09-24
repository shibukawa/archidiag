// The project as a Yjs document (decision:crdt-collaboration). Objects become Y.Maps key by key, so concurrent edits
// to different records, fields, or node positions merge; arrays of records with ids (fields, domain components,
// code set entries) become Y.Arrays so concurrent insertions both survive; other arrays and scalars are
// last-writer-wins values. Runtime-neutral: used by the browser and the Bun server alike.
import * as Y from 'yjs'
import { migrateProject } from './io'
import type { Project } from './model'

export const ROOT = 'project'

/** Array keys whose items are records with ids, merged item by item. */
const KEYED_ARRAYS = new Set(['attributes', 'components', 'entries'])

type Plain = Record<string, unknown>

const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value)
const isKeyed = (key: string, value: unknown): value is Plain[] => KEYED_ARRAYS.has(key) && Array.isArray(value) && value.every((item) => isPlain(item) && typeof item.id === 'string')

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** A fresh Yjs value for a JSON value under the given key. */
function toY(value: unknown, key: string): unknown {
  if (isPlain(value)) {
    const map = new Y.Map<unknown>()
    Object.entries(value).forEach(([child, item]) => { if (item !== undefined) map.set(child, toY(item, child)) })
    return map
  }
  if (isKeyed(key, value)) {
    const array = new Y.Array<unknown>()
    array.push(value.map((item) => toY(item, '')))
    return array
  }
  return value === undefined ? null : JSON.parse(JSON.stringify(value))
}

/**
 * Writes next into the map with the fewest changes. prev is the value the map last held as far as the caller
 * knows; subtrees whose reference did not change are skipped, which keeps a keystroke's update tiny.
 */
function syncMap(map: Y.Map<unknown>, prev: Plain | undefined, next: Plain) {
  ;[...map.keys()].forEach((key) => { if (next[key] === undefined) map.delete(key) })
  Object.entries(next).forEach(([key, value]) => {
    if (value === undefined) return
    if (prev && prev[key] === value && map.has(key)) return
    const current = map.get(key)
    if (isPlain(value) && current instanceof Y.Map) { syncMap(current, isPlain(prev?.[key]) ? (prev![key] as Plain) : undefined, value); return }
    if (isKeyed(key, value) && current instanceof Y.Array) { syncKeyedArray(current, Array.isArray(prev?.[key]) ? (prev![key] as Plain[]) : [], value); return }
    if (!isPlain(value) && !isKeyed(key, value) && !(current instanceof Y.AbstractType) && jsonEqual(current, value)) return
    map.set(key, toY(value, key))
  })
}

/**
 * Deletes, inserts, and moves items by id; items that stay in place keep their Y.Map so concurrent field edits merge.
 * A move is a delete and an insert, so two replicas moving one item leave two copies: the first copy of an id wins
 * and the others are removed here and ignored when reading.
 */
function syncKeyedArray(array: Y.Array<unknown>, prev: Plain[], next: Plain[]) {
  const idOf = (item: unknown) => (item instanceof Y.Map ? (item.get('id') as string | undefined) : undefined)
  const wanted = new Set(next.map((item) => item.id as string))
  const seen = new Set<string>()
  const keep = array.toArray().map((item) => { const id = idOf(item) ?? ''; const first = wanted.has(id) && !seen.has(id); seen.add(id); return first })
  for (let index = array.length - 1; index >= 0; index -= 1) if (!keep[index]) array.delete(index, 1)
  const before = new Map(prev.map((item) => [item.id as string, item]))
  next.forEach((item, position) => {
    const id = item.id as string
    const at = array.length > position ? idOf(array.get(position)) : undefined
    if (at === id) {
      const current = array.get(position)
      if (current instanceof Y.Map) syncMap(current, before.get(id), item)
      return
    }
    const existing = array.toArray().findIndex((candidate, index) => index > position && idOf(candidate) === id)
    if (existing >= 0) array.delete(existing, 1)
    array.insert(position, [toY(item, '')])
  })
  if (array.length > next.length) array.delete(next.length, array.length - next.length)
}

/** Keyed arrays as read from the document: the first item of each id. */
function dedupeKeyed(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    const items = KEYED_ARRAYS.has(key) ? value.filter((item, index) => !isPlain(item) || typeof item.id !== 'string' || value.findIndex((other) => isPlain(other) && other.id === item.id) === index) : value
    return items.map((item) => dedupeKeyed(item))
  }
  if (!isPlain(value)) return value
  return Object.fromEntries(Object.entries(value).map(([child, item]) => [child, dedupeKeyed(item, child)]))
}

export function projectMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(ROOT)
}

/** Writes a project into the document as one transaction, changing only what differs from prev. */
export function writeProject(doc: Y.Doc, next: Project, prev?: Project, origin: unknown = null) {
  doc.transact(() => syncMap(projectMap(doc), prev as unknown as Plain | undefined, next as unknown as Plain), origin)
}

/**
 * Rewrites the document to match a project with a full comparison, no subtree skipped: duplicate copies left by
 * concurrent moves go, and normalization is written once. The server runs it with the repaired project on save.
 */
export function compactProject(doc: Y.Doc, project: Project, origin: unknown) {
  writeProject(doc, project, undefined, origin)
}

/**
 * The project the document holds, migrated and normalized like an imported file; undefined while empty. Reading is
 * deterministic, so every replica sees the same project: nothing is invented (fields that lost their domain in a
 * merge keep a dangling reference until the server repairs them).
 */
export function readProject(doc: Y.Doc): Project | undefined {
  const raw = dedupeKeyed(projectMap(doc).toJSON()) as Plain
  if (!raw.id) return undefined
  return migrateProject(raw, { assignDomains: false })
}

// ---------- attribution (data:edit-operation origin) ----------

export interface Actor {
  id: string
  name: string
  kind: 'human' | 'agent'
  /** For an agent: the user it acts for (rule:ai-change-consent). */
  onBehalfOf?: string
  color?: string
}

export interface ActivityEntry {
  id: string
  revision: number
  at: string
  actor: Actor
  /** Changed records as collection:id. */
  targets: string[]
  summary: string
}

/** The records a transaction touched, as collection:id or collection for project-level keys. */
export function changedTargets(transaction: Y.Transaction, doc: Y.Doc): string[] {
  const root = projectMap(doc)
  const targets = new Set<string>()
  transaction.changed.forEach((keys, type) => {
    const path: string[] = []
    let current: Y.AbstractType<any> | null = type
    while (current && current !== root) {
      const item: Y.Item | null = current._item
      if (!item) break
      if (item.parentSub) path.unshift(item.parentSub)
      current = item.parent as Y.AbstractType<unknown> | null
    }
    if (current !== (root as unknown)) return
    if (!path.length) keys.forEach((key) => { if (key) targets.add(key) })
    else if (path.length === 1) keys.forEach((key) => targets.add(key ? `${path[0]}:${key}` : path[0]))
    else targets.add(`${path[0]}:${path[1]}`)
  })
  return [...targets].sort()
}

/** A readable summary of changed targets, naming records the way the editor does. */
export function describeTargets(project: Project | undefined, targets: string[]): string {
  const names = targets.slice(0, 4).map((target) => {
    const [collection, id] = target.split(/:(.*)/s)
    if (!id || !project) return collection
    const record = (project as unknown as Record<string, Record<string, { name?: string; businessName?: string; useCase?: string } | undefined>>)[collection]?.[id]
    return record?.name || record?.businessName || record?.useCase || id
  })
  return `${names.join(', ')}${targets.length > 4 ? ` +${targets.length - 4}` : ''}`
}

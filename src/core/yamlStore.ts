// A project as a folder of small YAML files, one record per file (decision:yaml-on-disk-json-in-browser,
// data:project-store). Pure conversion between file contents and the JSON model; the server does the file I/O.
import { parse, stringify } from 'yaml'
import { migrateProject, serializeProject } from './io'
import { SCHEMA_VERSION, type Project } from './model'

export const PROJECT_FILE = 'c4sketch.yaml'
export const FORMAT = 'c4sketch-project'

/** Record collections and the folder each is stored in. */
export const COLLECTIONS: Array<[keyof Project, string]> = [
  ['elements', 'elements'],
  ['relationships', 'relationships'],
  ['groups', 'groups'],
  ['views', 'views'],
  ['vocabulary', 'vocabulary'],
  ['domainCategories', 'domain-categories'],
  ['domains', 'domains'],
]

/** File-system-safe name for a record id; the id itself is stored inside the file. */
export function fileNameFor(id: string): string {
  return `${id.replace(/[^A-Za-z0-9._-]+/g, '_')}.yaml`
}

/** Stable key order: id first, then the rest alphabetically, so diffs stay small and reviewable. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
  entries.sort(([a], [b]) => (a === 'id' ? -1 : b === 'id' ? 1 : a < b ? -1 : a > b ? 1 : 0))
  return Object.fromEntries(entries.map(([key, item]) => [key, sortKeys(item)]))
}

const dump = (value: unknown) => stringify(sortKeys(value), { lineWidth: 0, aliasDuplicateObjects: false })

/** Every file of the project folder, keyed by relative path. */
export function projectToFiles(project: Project): Record<string, string> {
  const ordered = JSON.parse(serializeProject(project)) as Project
  const files: Record<string, string> = {
    [PROJECT_FILE]: dump({ format: FORMAT, id: ordered.id, name: ordered.name, schemaVersion: ordered.schemaVersion, settings: ordered.settings, layout: Object.fromEntries(COLLECTIONS.map(([key, folder]) => [key, folder])) }),
  }
  COLLECTIONS.forEach(([key, folder]) => {
    const used = new Set<string>()
    Object.values(ordered[key] as Record<string, { id: string }>).sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((record) => {
      let name = fileNameFor(record.id)
      for (let suffix = 2; used.has(name); suffix += 1) name = fileNameFor(`${record.id}-${suffix}`)
      used.add(name)
      files[`${folder}/${name}`] = dump(record)
    })
  })
  return files
}

export class ProjectFolderError extends Error {}

/** The project a folder holds; files outside the known layout are ignored, unknown keys inside records survive. */
export function filesToProject(files: Record<string, string>): Project {
  const header = files[PROJECT_FILE]
  if (!header) throw new ProjectFolderError(`${PROJECT_FILE} is missing`)
  const meta = parse(header) as { id?: string; name?: string; schemaVersion?: number; settings?: Project['settings']; layout?: Record<string, string> }
  if (!meta || typeof meta !== 'object' || !meta.id) throw new ProjectFolderError(`${PROJECT_FILE} has no project id`)
  const raw: Record<string, unknown> = { id: meta.id, name: meta.name ?? meta.id, schemaVersion: meta.schemaVersion ?? SCHEMA_VERSION, settings: meta.settings }
  COLLECTIONS.forEach(([key, defaultFolder]) => {
    const folder = meta.layout?.[key] ?? defaultFolder
    const records: Record<string, unknown> = {}
    Object.entries(files).filter(([path]) => path.startsWith(`${folder}/`) && path.endsWith('.yaml')).sort(([a], [b]) => (a < b ? -1 : 1)).forEach(([path, text]) => {
      const record = parse(text) as { id?: string } | null
      if (!record || typeof record !== 'object' || !record.id) throw new ProjectFolderError(`${path} has no id`)
      records[record.id] = record
    })
    raw[key] = records
  })
  return migrateProject(raw)
}

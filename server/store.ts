// data:project-store on disk: each project is a folder of YAML records (c4sketch.yaml at its root), plus the
// CRDT state that lets reconnecting browsers merge, and an append-only journal of attributed changes.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { hostname } from 'node:os'
import { emptyProject, type Project } from '../src/core/model'
import { COLLECTIONS, filesToProject, PROJECT_FILE, projectToFiles } from '../src/core/yamlStore'

export interface ProjectInfo { id: string; name: string; dir: string }

export interface JournalEntry {
  revision: number
  at: string
  actor: { id: string; name: string; kind: string; onBehalfOf?: string }
  targets: string[]
  summary: string
}

const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const CRDT_FILE = join('.crdt', 'state.bin')
const JOURNAL_FILE = join('.journal', 'journal.jsonl')
const FOLDER_GITIGNORE = '.lock\n.crdt/\n'

function slug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'project'
}

/** Writes through a temporary file so a crash never leaves half a record. */
function writeAtomic(path: string, content: string | Uint8Array) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, content)
  renameSync(temp, path)
}

export class StoreError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

/**
 * The folder a server was started on. A folder holding c4sketch.yaml is one project; a workspace folder holds one
 * project per subfolder. An empty or new folder becomes a single project named after it.
 */
export class ProjectStore {
  readonly root: string
  readonly mode: 'single' | 'workspace'

  constructor(root: string, options: { workspace?: boolean } = {}) {
    this.root = resolve(root)
    mkdirSync(this.root, { recursive: true })
    const hasProject = existsSync(join(this.root, PROJECT_FILE))
    const hasChildren = readdirSync(this.root).some((name) => existsSync(join(this.root, name, PROJECT_FILE)))
    this.mode = options.workspace || (!hasProject && hasChildren) ? 'workspace' : 'single'
    if (this.mode === 'single' && !hasProject) this.writeFolder(this.root, emptyProject(basename(this.root)))
  }

  list(): ProjectInfo[] {
    if (this.mode === 'single') return [this.info(slug(basename(this.root)), this.root)]
    return readdirSync(this.root)
      .filter((name) => PROJECT_ID.test(name) && existsSync(join(this.root, name, PROJECT_FILE)))
      .sort()
      .map((name) => this.info(name, join(this.root, name)))
  }

  private info(id: string, dir: string): ProjectInfo {
    let name = id
    try { name = (filesToProject({ [PROJECT_FILE]: readFileSync(join(dir, PROJECT_FILE), 'utf8') }).name) || id } catch { /* the listing still shows the folder */ }
    return { id, name, dir }
  }

  dirOf(id: string): string {
    const found = this.list().find((project) => project.id === id)
    if (!found) throw new StoreError(`No project ${id}`, 404)
    return found.dir
  }

  /** A new project folder in a workspace; the id comes from the name and never collides. */
  create(name: string, project?: Project): ProjectInfo {
    if (this.mode === 'single') throw new StoreError('This server serves one project folder; start it on a workspace folder with --workspace to create projects', 409)
    const base = slug(name)
    let id = base
    for (let suffix = 2; existsSync(join(this.root, id)); suffix += 1) id = `${base}-${suffix}`
    const dir = join(this.root, id)
    this.writeFolder(dir, { ...(project ?? emptyProject(name)), name })
    return { id, name, dir }
  }

  read(id: string): Project {
    return this.readFolder(this.dirOf(id))
  }

  /** Writes only the files whose content changed and removes records that no longer exist. */
  write(id: string, project: Project) {
    this.writeFolder(this.dirOf(id), project)
  }

  private readFolder(dir: string): Project {
    const files: Record<string, string> = { [PROJECT_FILE]: readFileSync(join(dir, PROJECT_FILE), 'utf8') }
    COLLECTIONS.forEach(([, folder]) => {
      const path = join(dir, folder)
      if (!existsSync(path)) return
      readdirSync(path).filter((name) => name.endsWith('.yaml')).forEach((name) => { files[`${folder}/${name}`] = readFileSync(join(path, name), 'utf8') })
    })
    return filesToProject(files)
  }

  private writeFolder(dir: string, project: Project) {
    const files = projectToFiles(project)
    Object.entries(files).forEach(([path, content]) => {
      const target = join(dir, path)
      if (existsSync(target) && readFileSync(target, 'utf8') === content) return
      writeAtomic(target, content)
    })
    COLLECTIONS.forEach(([, folder]) => {
      const path = join(dir, folder)
      if (!existsSync(path)) return
      readdirSync(path).filter((name) => name.endsWith('.yaml') && !files[`${folder}/${name}`]).forEach((name) => rmSync(join(path, name)))
    })
    if (!existsSync(join(dir, '.gitignore'))) writeAtomic(join(dir, '.gitignore'), FOLDER_GITIGNORE)
  }

  readCrdt(id: string): Uint8Array | undefined {
    const path = join(this.dirOf(id), CRDT_FILE)
    return existsSync(path) ? new Uint8Array(readFileSync(path)) : undefined
  }

  writeCrdt(id: string, state: Uint8Array) {
    writeAtomic(join(this.dirOf(id), CRDT_FILE), state)
  }

  /** Journal entries are immutable; corrections are new entries. */
  appendJournal(id: string, entry: JournalEntry) {
    const path = join(this.dirOf(id), JOURNAL_FILE)
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify(entry)}\n`)
  }

  readJournal(id: string, limit = 100): JournalEntry[] {
    const path = join(this.dirOf(id), JOURNAL_FILE)
    if (!existsSync(path)) return []
    return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).map((line) => JSON.parse(line) as JournalEntry)
  }

  lastRevision(id: string): number {
    return this.readJournal(id, 1)[0]?.revision ?? 0
  }

  // ---------- folder lock (data:project-store .lock) ----------

  private get lockPath() { return join(this.root, '.lock') }

  /** Takes the folder lock or explains who holds it; a dead holder's lock is stale and cleared only on request. */
  lock(options: { clearStale?: boolean } = {}) {
    if (existsSync(this.lockPath)) {
      const holder = JSON.parse(readFileSync(this.lockPath, 'utf8')) as { pid: number; startedAt: string; host: string }
      const alive = holder.host === hostname() && (() => { try { process.kill(holder.pid, 0); return true } catch { return false } })()
      // A lock from another host name cannot be checked (a laptop's name changes with the network); clearing it is explicit.
      if (alive || (holder.host !== hostname() && !options.clearStale)) throw new StoreError(`${this.root} is locked by pid ${holder.pid} on ${holder.host} since ${holder.startedAt}${holder.host !== hostname() ? '; if no server runs there, start with --clear-stale-lock' : ''}`, 423)
      if (!options.clearStale) throw new StoreError(`${this.root} has a stale lock from pid ${holder.pid} (${holder.startedAt}); run again with --clear-stale-lock`, 423)
    }
    writeAtomic(this.lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), host: hostname() }))
  }

  unlock() {
    try {
      const holder = JSON.parse(readFileSync(this.lockPath, 'utf8')) as { pid: number }
      if (holder.pid === process.pid) rmSync(this.lockPath)
    } catch { /* already gone */ }
  }
}

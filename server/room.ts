// One collaboration session per open project (data:collaboration-session): the server's replica of the project
// document, the connected browsers and agents, presence, persistence, and attribution. Speaks the standard Yjs
// sync and awareness protocol, so any y-websocket client can join.
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as Y from 'yjs'
import { changedTargets, compactProject, describeTargets, projectMap, readProject, writeProject, type ActivityEntry, type Actor } from '../src/core/crdt'
import { assignMissingDomains } from '../src/core/domains'
import type { Project } from '../src/core/model'
import { projectToFiles } from '../src/core/yamlStore'
import type { ProjectStore } from './store'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const MESSAGE_QUERY_AWARENESS = 3

export type Role = 'edit' | 'read_only'

export interface Connection {
  send: (data: Uint8Array) => void
  actor: Actor
  role: Role
  /** Awareness client ids this connection announced, removed when it leaves. */
  clientIds: Set<number>
}

export interface AgentSession {
  key: string
  actor: Actor
  undo: Y.UndoManager
  presenceId: number
  lastSeen: number
}

/** Transaction origins the server writes with itself. */
const LOADED = { system: 'loaded' }
const REPAIRED = { system: 'repaired' }
const DISK_ACTOR: Actor = { id: 'disk', name: 'Files on disk', kind: 'human' }

const COALESCE_MS = 1500
const SAVE_MS = 400
const SAVE_MAX_WAIT_MS = 3000
const ACTIVITY_SHOWN = 60
const AGENT_PRESENCE_MS = 10_000
const AGENT_IDLE_MS = 120_000

function sameContent(a: Project, b: Project): boolean {
  return JSON.stringify(projectToFiles(a)) === JSON.stringify(projectToFiles(b))
}

export class Room {
  readonly doc = new Y.Doc()
  readonly awareness = new awarenessProtocol.Awareness(this.doc)
  readonly connections = new Set<Connection>()
  readonly agents = new Map<string, AgentSession>()
  revision = 0
  private cached: Project | undefined
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private firstUnsaved = 0
  private activity: ActivityEntry[] = []
  /** The server's own presence entry, which carries the recent activity so no participant can forge it. */
  private readonly serverPresenceId = Math.floor(Math.random() * 0x7fffffff)
  lastActive = Date.now()
  private pending: { actor: Actor; targets: Set<string>; revision: number; timer: ReturnType<typeof setTimeout> } | undefined
  private presenceTimer: ReturnType<typeof setInterval>

  private constructor(readonly id: string, private readonly store: ProjectStore, private readonly log: (message: string) => void) {
    this.awareness.setLocalState(null)
    this.presenceTimer = setInterval(() => this.refreshAgents(), AGENT_PRESENCE_MS)
  }

  /**
   * Opens a project: the saved CRDT state first, so reconnecting browsers merge into the same history; YAML files
   * edited on disk while the server was down are applied on top as an edit by "Files on disk".
   */
  static open(store: ProjectStore, id: string, log: (message: string) => void): Room {
    const fromDisk = store.read(id)
    const room = new Room(id, store, log)
    room.activity = store.readJournal(id, ACTIVITY_SHOWN).map((entry) => ({ id: `${entry.revision}-${entry.actor.id}`, ...entry, actor: entry.actor as Actor })).reverse()
    const state = store.readCrdt(id)
    if (state) Y.applyUpdate(room.doc, state, LOADED)
    room.revision = store.lastRevision(id)
    room.doc.on('update', (update: Uint8Array, origin: unknown) => room.onUpdate(update, origin))
    room.doc.on('afterTransaction', (transaction: Y.Transaction) => room.onTransaction(transaction))
    room.awareness.on('update', (changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => room.onAwareness(changes, origin))
    const current = readProject(room.doc)
    if (!current) writeProject(room.doc, fromDisk, undefined, LOADED)
    else if (!sameContent(current, fromDisk)) {
      log(`${id}: files changed on disk since the last session; applying them`)
      writeProject(room.doc, fromDisk, current, DISK_ACTOR)
    }
    room.announceActivity()
    return room
  }

  /** The project as the document holds it now; cached until the next update. */
  project(): Project {
    this.cached ??= readProject(this.doc)
    if (!this.cached) throw new Error(`Project ${this.id} is empty`)
    return this.cached
  }

  // ---------- browsers ----------

  join(connection: Connection) {
    this.connections.add(connection)
    this.lastActive = Date.now()
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, this.doc)
    connection.send(encoding.toUint8Array(encoder))
    const states = [...this.awareness.getStates().keys()]
    if (states.length) connection.send(this.awarenessMessage(states))
  }

  leave(connection: Connection) {
    this.connections.delete(connection)
    this.lastActive = Date.now()
    awarenessProtocol.removeAwarenessStates(this.awareness, [...connection.clientIds], null)
  }

  /** A read-only participant may sync and announce presence, but its document updates are dropped. */
  receive(connection: Connection, data: Uint8Array) {
    const decoder = decoding.createDecoder(data)
    const encoder = encoding.createEncoder()
    const type = decoding.readVarUint(decoder)
    if (type === MESSAGE_SYNC) {
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      if (connection.role === 'read_only') {
        if (decoding.readVarUint(decoder) === syncProtocol.messageYjsSyncStep1) syncProtocol.readSyncStep1(decoder, encoder, this.doc)
      } else syncProtocol.readSyncMessage(decoder, encoder, this.doc, connection)
      if (encoding.length(encoder) > 1) connection.send(encoding.toUint8Array(encoder))
    } else if (type === MESSAGE_AWARENESS) {
      const update = this.ownPresence(connection, decoding.readVarUint8Array(decoder))
      if (update) awarenessProtocol.applyAwarenessUpdate(this.awareness, update, connection)
    } else if (type === MESSAGE_QUERY_AWARENESS) {
      connection.send(this.awarenessMessage([...this.awareness.getStates().keys()]))
    }
  }

  /**
   * Keeps a presence update to the sender's own client ids and, with login, to the sender's identity: nobody can
   * pose as another participant, an agent, or the server, or remove someone else's presence.
   */
  private ownPresence(connection: Connection, update: Uint8Array): Uint8Array | undefined {
    const decoder = decoding.createDecoder(update)
    const encoder = encoding.createEncoder()
    const count = decoding.readVarUint(decoder)
    const kept: Array<[number, number, string]> = []
    const claimed = new Set<number>([this.serverPresenceId, ...[...this.agents.values()].map((agent) => agent.presenceId)])
    this.connections.forEach((other) => { if (other !== connection) other.clientIds.forEach((id) => claimed.add(id)) })
    for (let index = 0; index < count; index += 1) {
      const clientId = decoding.readVarUint(decoder)
      const clock = decoding.readVarUint(decoder)
      const json = decoding.readVarString(decoder)
      if (claimed.has(clientId)) continue
      let state = JSON.parse(json) as { user?: Record<string, unknown> } | null
      if (state && typeof state === 'object') state = { ...state, user: { ...(state.user ?? {}), id: connection.actor.id, name: connection.actor.name, color: (state.user?.color as string | undefined) ?? connection.actor.color, kind: 'human', onBehalfOf: undefined } }
      kept.push([clientId, clock, JSON.stringify(state)])
    }
    if (!kept.length) return undefined
    encoding.writeVarUint(encoder, kept.length)
    kept.forEach(([clientId, clock, json]) => { encoding.writeVarUint(encoder, clientId); encoding.writeVarUint(encoder, clock); encoding.writeVarString(encoder, json) })
    return encoding.toUint8Array(encoder)
  }

  private awarenessMessage(clients: number[]): Uint8Array {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients))
    return encoding.toUint8Array(encoder)
  }

  private broadcast(message: Uint8Array, except?: unknown) {
    this.connections.forEach((connection) => { if (connection !== except) connection.send(message) })
  }

  private onUpdate(update: Uint8Array, origin: unknown) {
    this.cached = undefined
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeUpdate(encoder, update)
    this.broadcast(encoding.toUint8Array(encoder), origin)
    this.scheduleSave()
  }

  private onAwareness({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) {
    const connection = [...this.connections].find((candidate) => candidate === origin)
    if (connection) {
      added.forEach((id) => connection.clientIds.add(id))
      removed.forEach((id) => connection.clientIds.delete(id))
    }
    const changed = [...added, ...updated, ...removed]
    if (changed.length) this.broadcast(this.awarenessMessage(changed))
  }

  // ---------- attribution and history ----------

  /** Connections, agent sessions, and direct edits carry their actor; an agent's undo counts as the agent's. */
  private actorOf(origin: unknown): Actor | undefined {
    if (origin === LOADED || origin === REPAIRED) return undefined
    if (origin === DISK_ACTOR) return DISK_ACTOR
    for (const agent of this.agents.values()) if (agent.undo === origin) return agent.actor
    return origin && typeof origin === 'object' && 'actor' in origin ? (origin as { actor: Actor }).actor : undefined
  }

  /** Writes a whole project as one attributed edit, as a PUT of the portable file does. */
  applyAs(actor: Actor, next: Project) {
    writeProject(this.doc, next, this.project(), { actor })
    this.flushActivity()
  }

  /** Every accepted change gets the next revision; changes by one actor in quick succession share one entry. */
  private onTransaction(transaction: Y.Transaction) {
    const actor = this.actorOf(transaction.origin)
    if (!actor) return
    const targets = changedTargets(transaction, this.doc)
    if (!targets.length) return
    this.revision += 1
    if (this.pending && this.pending.actor.id !== actor.id) this.flushActivity()
    if (!this.pending) this.pending = { actor, targets: new Set(), revision: this.revision, timer: setTimeout(() => this.flushActivity(), COALESCE_MS) }
    targets.forEach((target) => this.pending!.targets.add(target))
    this.pending.revision = this.revision
  }

  private flushActivity() {
    const pending = this.pending
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending = undefined
    const targets = [...pending.targets].sort()
    const entry: ActivityEntry = { id: `${pending.revision}-${pending.actor.id}`, revision: pending.revision, at: new Date().toISOString(), actor: pending.actor, targets, summary: describeTargets(this.cached ?? readProject(this.doc), targets) }
    this.activity = [entry, ...this.activity].slice(0, ACTIVITY_SHOWN)
    this.announceActivity()
    try { this.store.appendJournal(this.id, { revision: entry.revision, at: entry.at, actor: entry.actor, targets, summary: entry.summary }) } catch (error) { this.log(`${this.id}: journal write failed: ${String(error)}`) }
  }

  // ---------- persistence ----------

  /** Saves shortly after the last change, and at least every few seconds while edits keep coming. */
  private scheduleSave() {
    clearTimeout(this.saveTimer)
    this.firstUnsaved ||= Date.now()
    this.saveTimer = setTimeout(() => this.save(), Date.now() - this.firstUnsaved > SAVE_MAX_WAIT_MS ? 0 : SAVE_MS)
  }

  /**
   * Writes the CRDT state and the YAML folder; a document that fails to read keeps the last good files. Fields a
   * merge left without a domain get their same-named one here, once, from the one authority.
   */
  save() {
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    this.firstUnsaved = 0
    try {
      compactProject(this.doc, assignMissingDomains(this.project()), REPAIRED)
      this.store.writeCrdt(this.id, Y.encodeStateAsUpdate(this.doc))
      this.store.write(this.id, this.project())
    } catch (error) {
      this.log(`${this.id}: save failed: ${String(error)}`)
    }
  }

  // ---------- agents (api:mcp-server) ----------

  /** The agent's session in this room: its presence and its own undo stack (rule:undo-scope). */
  agent(key: string, actor: Actor): AgentSession {
    let session = this.agents.get(key)
    if (!session) {
      // Tracks only this session's origin; the default would also capture edits with no origin.
      const origins = new Set<unknown>()
      const created: AgentSession = { key, actor, undo: new Y.UndoManager(projectMap(this.doc), { captureTimeout: 0, trackedOrigins: origins }), presenceId: Math.floor(Math.random() * 0x7fffffff), lastSeen: Date.now() }
      origins.add(created)
      session = created
      this.agents.set(key, session)
    }
    session.actor = actor
    session.lastSeen = Date.now()
    this.lastActive = session.lastSeen
    this.announceAgent(session)
    return session
  }

  /** Writes an agent's finished edit as one transaction and one undo step; the caller checked the agent may edit. */
  applyAsAgent(session: AgentSession, next: Project) {
    const current = this.project()
    if (next === current) return
    session.undo.stopCapturing()
    writeProject(this.doc, next, current, session)
    session.lastSeen = Date.now()
    this.flushActivity()
  }

  /** Undoes the agent's latest edit, found by session key or actor id; returns false when it has none left. */
  undoAgent(key: string): boolean {
    const session = this.agents.get(key) ?? [...this.agents.values()].find((candidate) => candidate.actor.id === key)
    if (!session || !session.undo.canUndo()) return false
    session.undo.undo()
    this.flushActivity()
    return true
  }

  /** Agents and the server have no socket, so the server announces their presence under client ids of their own. */
  private announce(clientId: number, state: Record<string, unknown>) {
    const meta = this.awareness.meta.get(clientId)
    this.awareness.states.set(clientId, state)
    this.awareness.meta.set(clientId, { clock: (meta?.clock ?? 0) + 1, lastUpdated: Date.now() })
    this.broadcast(this.awarenessMessage([clientId]))
  }

  private announceAgent(session: AgentSession) {
    this.announce(session.presenceId, { user: { id: session.actor.id, name: session.actor.name, color: session.actor.color ?? '#a68bfa', kind: 'agent', onBehalfOf: session.actor.onBehalfOf }, revision: this.revision })
  }

  /** Recent attributed changes, newest first, as the server's presence state. */
  private announceActivity() {
    this.announce(this.serverPresenceId, { server: true, revision: this.revision, activity: this.activity })
  }

  private refreshAgents() {
    const now = Date.now()
    this.announceActivity()
    this.agents.forEach((session) => {
      if (now - session.lastSeen > AGENT_IDLE_MS) {
        this.agents.delete(session.key)
        awarenessProtocol.removeAwarenessStates(this.awareness, [session.presenceId], null)
        session.undo.destroy()
      } else this.announceAgent(session)
    })
  }

  participants() {
    return [...this.awareness.getStates().entries()].filter(([, state]) => (state as { user?: unknown }).user).map(([clientId, state]) => ({ clientId, ...(state as Record<string, unknown>) }))
  }

  /** Nobody is connected and no agent has been active for a while: the room can close. */
  idle(now: number, afterMs: number) {
    return !this.connections.size && !this.agents.size && now - this.lastActive > afterMs
  }

  close() {
    this.flushActivity()
    this.save()
    clearInterval(this.presenceTimer)
    this.awareness.destroy()
    this.doc.destroy()
  }
}

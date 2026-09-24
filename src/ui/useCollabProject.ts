import { useCallback, useEffect, useRef, useState } from 'react'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { projectMap, readProject, writeProject, type ActivityEntry } from '../core/crdt'
import type { Project } from '../core/model'
import { collabUrl, type Credentials } from './serverApi'

/** data:collaboration-session states as the browser sees them. */
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'closed'

export interface Participant {
  clientId: number
  self: boolean
  id: string
  name: string
  color: string
  kind: 'human' | 'agent'
  onBehalfOf?: string
  viewId?: string
  selection: string[]
}

export interface CollabTarget { projectId: string; credentials: Credentials; color: string; role: 'edit' | 'read_only' }

const LOCAL = { local: true }

/**
 * One shared project (requirement: optional-collaboration). Local edits write the difference into the Yjs document;
 * remote edits and undo re-read it. Undo and redo track only this participant's own transactions (rule: undo-scope),
 * and consecutive edits with one batch key fold into one step like the local history does.
 */
export function useCollabProject(target: CollabTarget | null) {
  const [project, setProject] = useState<Project | null>(null)
  const [state, setState] = useState<ConnectionState>('closed')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [, bump] = useState(0)
  const projectRef = useRef<Project | null>(null)
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const undoRef = useRef<Y.UndoManager | null>(null)
  const batchKey = useRef<string | null>(null)
  const readOnly = target?.role === 'read_only'
  const key = target ? `${target.projectId}|${target.credentials.name}|${target.credentials.token ?? ''}` : ''

  useEffect(() => {
    if (!target) return
    const doc = new Y.Doc()
    const params: Record<string, string> = target.credentials.token ? { token: target.credentials.token } : { name: target.credentials.name || 'Local user', color: target.color }
    // The server relays every change, so a read-only tab can never pass edits to another tab directly.
    const provider = new WebsocketProvider(collabUrl(), target.projectId, doc, { params, disableBc: true })
    const undo = new Y.UndoManager(projectMap(doc), { trackedOrigins: new Set([LOCAL]), captureTimeout: Number.MAX_SAFE_INTEGER })
    docRef.current = doc
    providerRef.current = provider
    undoRef.current = undo
    setState('connecting')
    let everSynced = false
    const reread = () => {
      try {
        const next = readProject(doc)
        if (!next) return
        projectRef.current = next
        setProject(next)
      } catch (error) {
        console.error('Shared project could not be read', error)
      }
    }
    const onStatus = ({ status }: { status: string }) => setState(status === 'connected' ? (everSynced ? 'connected' : 'connecting') : everSynced ? 'reconnecting' : 'connecting')
    const onSync = (synced: boolean) => {
      if (!synced) return
      everSynced = true
      setState('connected')
      reread()
    }
    const onDeep = (_events: unknown, transaction: Y.Transaction) => { if (transaction.origin !== LOCAL) reread() }
    const onStack = () => bump((value) => value + 1)
    const onAwareness = () => {
      const self = provider.awareness.clientID
      // The server's own presence entry carries the recent attributed changes.
      const server = [...provider.awareness.getStates().values()].find((state) => (state as { server?: boolean }).server) as { activity?: ActivityEntry[] } | undefined
      setActivity(server?.activity ?? [])
      setParticipants([...provider.awareness.getStates().entries()].flatMap(([clientId, raw]) => {
        const value = raw as { user?: { id?: string; name?: string; color?: string; kind?: 'human' | 'agent'; onBehalfOf?: string }; view?: { viewId?: string; selection?: string[] } }
        if (!value.user) return []
        return [{ clientId, self: clientId === self, id: value.user.id ?? String(clientId), name: value.user.name ?? '?', color: value.user.color ?? '#8390aa', kind: value.user.kind ?? 'human', onBehalfOf: value.user.onBehalfOf, viewId: value.view?.viewId, selection: value.view?.selection ?? [] }]
      }))
    }
    provider.on('status', onStatus)
    provider.on('sync', onSync)
    projectMap(doc).observeDeep(onDeep)
    undo.on('stack-item-added', onStack)
    undo.on('stack-item-popped', onStack)
    provider.awareness.on('change', onAwareness)
    provider.awareness.setLocalStateField('user', { id: target.credentials.token ? `user:${target.credentials.name}` : `local:${target.credentials.name}`, name: target.credentials.name || 'Local user', color: target.color, kind: 'human' })
    return () => {
      provider.awareness.off('change', onAwareness)
      projectMap(doc).unobserveDeep(onDeep)
      undo.destroy()
      provider.destroy()
      doc.destroy()
      docRef.current = null
      providerRef.current = null
      undoRef.current = null
      projectRef.current = null
      batchKey.current = null
      setProject(null)
      setParticipants([])
      setActivity([])
      setState('closed')
    }
    // The session is identified by key; target's other fields are fixed for it.
  }, [key])

  const commit = useCallback((mutator: (current: Project) => Project, batch?: string) => {
    const doc = docRef.current
    const current = projectRef.current
    if (!doc || !current || readOnly) return
    const next = mutator(current)
    if (next === current) return
    if (!batch || batch !== batchKey.current) undoRef.current?.stopCapturing()
    batchKey.current = batch ?? null
    writeProject(doc, next, current, LOCAL)
    projectRef.current = next
    setProject(next)
  }, [readOnly])

  const endBatch = useCallback(() => { batchKey.current = null }, [])
  const undo = useCallback(() => { batchKey.current = null; undoRef.current?.undo() }, [])
  const redo = useCallback(() => { batchKey.current = null; undoRef.current?.redo() }, [])

  /** Tells the others which view this participant looks at and what it selected. */
  const publishView = useCallback((viewId: string, selection: string[]) => {
    providerRef.current?.awareness.setLocalStateField('view', { viewId, selection })
  }, [])

  return {
    project,
    projectRef,
    state,
    participants,
    activity,
    readOnly,
    commit,
    endBatch,
    undo,
    redo,
    canUndo: Boolean(undoRef.current?.canUndo()),
    canRedo: Boolean(undoRef.current?.canRedo()),
    publishView,
  }
}

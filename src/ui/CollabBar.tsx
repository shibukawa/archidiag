import { useEffect, useState } from 'react'
import type { ActivityEntry } from '../core/crdt'
import type { Project } from '../core/model'
import type { Copy } from './i18n'
import { Icon } from './icons'
import { listProjects, type Credentials, type ServerInfo, type ServerProject, type SessionInfo } from './serverApi'
import type { ConnectionState, Participant } from './useCollabProject'

export interface CollabBarProps {
  copy: Copy
  server: ServerInfo
  credentials: Credentials
  onCredentials: (credentials: Credentials) => void
  session?: SessionInfo
  sessionError?: string
  /** The shared project open now, if any. */
  sharedProjectId?: string
  state: ConnectionState
  participants: Participant[]
  activity: ActivityEntry[]
  readOnly: boolean
  project: Project
  views: Record<string, { name: string; useCase?: string; kind: string }>
  onOpenProject: (projectId: string) => void
  onShareCurrent: () => void
  onCreateBlank: (name: string) => void
  onLeave: (keepCopy: boolean) => void
  onUndoAgent: (actorId: string) => void
  onOpenView: (viewId: string) => void
  onDownload: () => void
}

const STATE_STYLE: Record<ConnectionState, string> = { connected: 'bg-emerald-400', connecting: 'bg-amber', reconnecting: 'bg-amber animate-pulse', closed: 'bg-rose-400' }

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]).join('').toUpperCase() || '?'
}

function Avatar({ participant }: { participant: Pick<Participant, 'name' | 'color' | 'kind'> }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink text-[9px] font-bold text-ink" style={{ background: participant.color }} title={participant.name}>{participant.kind === 'agent' ? 'AI' : initials(participant.name)}</span>
}

/** The optional server in the header: open or share projects, then presence, activity, and the session state. */
export function CollabBar(props: CollabBarProps) {
  const { copy, server, credentials, session, sessionError, sharedProjectId, state, participants, activity, readOnly } = props
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<ServerProject[] | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState(credentials.name)
  const [token, setToken] = useState(credentials.token ?? '')
  const [blankName, setBlankName] = useState('')
  const c = copy.collab
  useEffect(() => {
    if (!open || !session) return
    listProjects(credentials).then(setProjects).catch((reason: Error) => setError(reason.message))
  }, [credentials, open, session])
  const others = participants.filter((participant) => !participant.self)
  const mcpUrl = new URL('mcp', window.location.href.split('#')[0].split('?')[0]).toString()
  // The newest entry of each agent carries the undo button; the server undoes that agent's latest edit.
  // Only agents still attached have an undo stack on the server.
  const latestByAgent = new Set<string>()
  const attached = new Set(participants.filter((participant) => participant.kind === 'agent').map((participant) => participant.id))
  const undoable = new Set(activity.filter((entry) => entry.actor.kind === 'agent' && attached.has(entry.actor.id) && !latestByAgent.has(entry.actor.id) && latestByAgent.add(entry.actor.id)).map((entry) => entry.id))
  const viewLabel = (viewId?: string) => { const view = viewId ? props.views[viewId] : undefined; return view ? view.useCase || view.name || copy.viewKinds[view.kind as keyof typeof copy.viewKinds] : '' }
  return (
    <div className="relative">
      <button type="button" className={`flex items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] ${sharedProjectId ? 'border-cyan/30 bg-cyan/5 text-cyan' : 'border-line bg-panel/60 text-muted hover:text-base-content'}`} onClick={() => setOpen((value) => !value)} title={c.serverHint}>
        {sharedProjectId ? <span className={`h-2 w-2 rounded-full ${STATE_STYLE[state]}`} /> : <Icon name="globe" size={13} />}
        {sharedProjectId ? c.states[state] : c.server}
        {readOnly && <span className="rounded bg-amber/15 px-1 text-[9px] text-amber">{c.readOnly}</span>}
        {sharedProjectId && others.length > 0 && <span className="flex -space-x-1.5">{others.slice(0, 4).map((participant) => <Avatar key={participant.clientId} participant={participant} />)}{others.length > 4 && <span className="grid h-6 w-6 place-items-center rounded-full bg-panel text-[9px]">+{others.length - 4}</span>}</span>}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 max-h-[80vh] w-[360px] overflow-y-auto rounded-xl border border-line bg-panel p-3 text-xs shadow-glow">
          <div className="mb-2 flex items-center justify-between">
            <div className="section-label">{c.title}</div>
            <button type="button" className="text-muted hover:text-base-content" onClick={() => setOpen(false)} aria-label="close"><Icon name="x" size={13} /></button>
          </div>
          {server.auth === 'token' ? (
            <div className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{c.token}</div>
              <div className="flex gap-1">
                <input className="inspector-input py-1 text-xs" type="password" value={token} placeholder={c.tokenPlaceholder} onChange={(event) => setToken(event.target.value)} />
                <button type="button" className="btn btn-primary btn-xs text-ink" onClick={() => props.onCredentials({ ...credentials, token: token.trim() || undefined })}>{c.logIn}</button>
              </div>
              {session && <p className="mt-1 text-[10px] text-muted">{c.signedInAs(session.user.name, session.role === 'read_only' ? c.readOnly : c.canEdit)}</p>}
            </div>
          ) : (
            <div className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{c.yourName}</div>
              <div className="flex gap-1">
                <input className="inspector-input py-1 text-xs" value={name} placeholder={c.namePlaceholder} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) props.onCredentials({ ...credentials, name: name.trim() }) }} />
                <button type="button" className="btn btn-ghost btn-xs text-cyan" disabled={name.trim() === credentials.name} onClick={() => props.onCredentials({ ...credentials, name: name.trim() })}>{c.save}</button>
              </div>
            </div>
          )}
          {(sessionError || error) && <p className="mb-2 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">{sessionError || error}</p>}
          {sharedProjectId ? (
            <>
              <div className="mb-3 rounded-lg border border-line bg-ink/40 px-2.5 py-2">
                <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${STATE_STYLE[state]}`} /><span className="font-semibold">{props.project.name}</span><span className="ml-auto text-[10px] text-muted">{c.states[state]}</span></div>
                <p className="mt-1 text-[10px] leading-4 text-muted">{state === 'reconnecting' ? c.reconnectingHint : readOnly ? c.readOnlyHint : c.sharedHint}</p>
              </div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{c.participants} · {participants.length}</div>
              <div className="mb-3 space-y-0.5">
                {participants.map((participant) => (
                  <button key={participant.clientId} type="button" className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/5" onClick={() => participant.viewId && props.views[participant.viewId] && props.onOpenView(participant.viewId)}>
                    <Avatar participant={participant} />
                    <span className="truncate">{participant.name}{participant.self ? ` (${c.you})` : ''}</span>
                    {participant.kind === 'agent' && <span className="shrink-0 rounded bg-violet/15 px-1 text-[9px] text-violet">{c.agent}</span>}
                    <span className="ml-auto truncate text-[10px] text-muted">{participant.kind === 'agent' ? (participant.onBehalfOf ? c.onBehalfOf(participant.onBehalfOf) : '') : viewLabel(participant.viewId)}</span>
                  </button>
                ))}
              </div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{c.activity}</div>
              <div className="mb-3 max-h-56 space-y-0.5 overflow-y-auto">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.actor.color ?? '#8390aa' }} />
                    <span className="min-w-0 flex-1 truncate" title={entry.targets.join('\n')}><span className="font-semibold">{entry.actor.name}</span> <span className="text-muted">{entry.summary}</span></span>
                    <span className="shrink-0 text-[9px] text-muted">r{entry.revision} · {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {undoable.has(entry.id) && !readOnly && <button type="button" className="shrink-0 text-[10px] text-cyan hover:underline" title={c.undoAgentHint} onClick={() => props.onUndoAgent(entry.actor.id)}>{c.undo}</button>}
                  </div>
                ))}
                {!activity.length && <p className="px-1.5 text-[10px] text-muted">{c.noActivity}</p>}
              </div>
              <div className="mb-3 rounded-lg border border-line bg-ink/40 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted">{c.mcp}</div>
                <div className="mt-1 flex items-center gap-1"><code className="min-w-0 flex-1 truncate text-[11px]">{mcpUrl}</code><button type="button" className="text-muted hover:text-cyan" title={copy.copyLink} onClick={() => navigator.clipboard?.writeText(mcpUrl)}><Icon name="copy" size={12} /></button></div>
                <p className="mt-1 text-[10px] leading-4 text-muted">{c.mcpHint}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="btn btn-ghost btn-xs text-muted" onClick={props.onDownload}>{c.download}</button>
                <button type="button" className="btn btn-ghost btn-xs text-muted" onClick={() => { props.onLeave(true); setOpen(false) }}>{c.leaveKeep}</button>
                <button type="button" className="btn btn-ghost btn-xs text-rose-300" onClick={() => { props.onLeave(false); setOpen(false) }}>{c.leave}</button>
              </div>
            </>
          ) : session ? (
            <>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{c.projects}</div>
              <div className="mb-3 space-y-0.5">
                {projects === null && <p className="px-1.5 text-[10px] text-muted">{c.loading}</p>}
                {projects?.map((item) => (
                  <button key={item.id} type="button" className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/5" onClick={() => { props.onOpenProject(item.id); setOpen(false) }}>
                    <Icon name="folder" size={13} className="shrink-0 text-cyan" />
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto text-[10px] text-muted">{item.participants ? c.editingNow(item.participants) : item.id}</span>
                  </button>
                ))}
              </div>
              {server.canCreate && session.role === 'edit' && (
                <div className="space-y-1.5">
                  <button type="button" className="btn btn-primary btn-xs w-full text-ink" onClick={() => { props.onShareCurrent(); setOpen(false) }}>{c.shareCurrent(props.project.name)}</button>
                  <div className="flex gap-1">
                    <input className="inspector-input py-1 text-xs" value={blankName} placeholder={c.blankPlaceholder} onChange={(event) => setBlankName(event.target.value)} />
                    <button type="button" className="btn btn-ghost btn-xs text-cyan" disabled={!blankName.trim()} onClick={() => { props.onCreateBlank(blankName.trim()); setOpen(false) }}>{c.create}</button>
                  </div>
                </div>
              )}
              {!server.canCreate && <p className="text-[10px] leading-4 text-muted">{c.singleHint}</p>}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

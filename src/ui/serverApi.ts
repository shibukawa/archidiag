// The optional Bun server as the browser sees it (decision:static-first-architecture): detected at start, absent on
// the static build. Paths are relative so the app also works under a sub-path.
import type { Project } from '../core/model'

export interface ServerInfo { server: 'c4sketch'; version: string; auth: 'none' | 'token'; mode: 'single' | 'workspace'; canCreate: boolean }
export interface ServerProject { id: string; name: string; participants: number }
export interface Credentials { name: string; token?: string }
export interface SessionInfo { user: { id: string; name: string; color: string }; role: 'edit' | 'read_only' }

const CREDENTIALS_KEY = 'c4sketch-server-credentials'

export function loadCredentials(): Credentials {
  try {
    const saved = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) ?? '{}') as Partial<Credentials>
    return { name: saved.name ?? '', token: saved.token || undefined }
  } catch {
    return { name: '' }
  }
}

export function saveCredentials(credentials: Credentials) {
  try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)) } catch { /* kept for this session only */ }
}

function headers(credentials: Credentials): Record<string, string> {
  return credentials.token ? { authorization: `Bearer ${credentials.token}` } : { 'x-c4sketch-user': encodeURIComponent(credentials.name || 'Local user') }
}

async function request<T>(path: string, credentials: Credentials, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...headers(credentials), ...(init.headers ?? {}) } })
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`)
  return body
}

/** The server this page was served from, or undefined on a static host. */
export async function detectServer(): Promise<ServerInfo | undefined> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const response = await fetch('api/health', { signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) return undefined
    const body = await response.json() as ServerInfo
    return body.server === 'c4sketch' ? body : undefined
  } catch {
    return undefined
  }
}

export const fetchSession = (credentials: Credentials) => request<SessionInfo>('api/session', credentials)
export const listProjects = (credentials: Credentials) => request<{ projects: ServerProject[] }>('api/projects', credentials).then((body) => body.projects)
export const createProject = (credentials: Credentials, name: string, project?: Project) => request<{ id: string; name: string }>('api/projects', credentials, { method: 'POST', body: JSON.stringify({ name, project }) })
export const undoAgent = (credentials: Credentials, projectId: string, agentKey: string) => request<{ undone: boolean }>(`api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentKey)}/undo`, credentials, { method: 'POST' })

export async function downloadProject(credentials: Credentials, projectId: string): Promise<Blob> {
  const response = await fetch(`api/projects/${encodeURIComponent(projectId)}`, { headers: headers(credentials) })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.blob()
}

/** WebSocket base for the collaboration gateway, beside the page. */
export function collabUrl(): string {
  const url = new URL('api/collab', window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.search = ''
  url.hash = ''
  return url.toString()
}

/** The server project named in the page address (?project=), which a shared link carries. */
export function projectFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('project') ?? undefined
}

export function setProjectInUrl(projectId: string | undefined) {
  const url = new URL(window.location.href)
  if (projectId) url.searchParams.set('project', projectId)
  else url.searchParams.delete('project')
  window.history.replaceState(null, '', url.toString())
}

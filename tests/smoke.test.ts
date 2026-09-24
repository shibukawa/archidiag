// Smoke test for CI: the core loads, checks, and exports; the real CLI serves a project, two clients converge, an
// MCP edit reaches them, and stopping the server saves the YAML folder and releases the lock.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import * as commands from '../src/core/commands'
import { readProject, writeProject } from '../src/core/crdt'
import { buildDdl } from '../src/core/ddl'
import { commerceStarter } from '../src/core/starter'
import { allFindings } from '../src/core/validate'
import { projectToFiles } from '../src/core/yamlStore'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check: () => boolean, timeout = 5000) {
  const start = Date.now()
  while (!check()) { if (Date.now() - start > timeout) throw new Error('timed out'); await wait(25) }
}

describe('core', () => {
  test('the starter validates and exports DDL', () => {
    const project = commerceStarter()
    expect(allFindings(project).filter((finding) => finding.level === 'error')).toEqual([])
    expect(buildDdl(project, 'container:orders-db').sql).toContain('CREATE TABLE customer')
  })
})

describe('server', () => {
  let root = ''
  let server: ReturnType<typeof Bun.spawn> | undefined
  let url = ''
  let projectId = ''
  const providers: WebsocketProvider[] = []

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'c4sketch-smoke-'))
    Object.entries(projectToFiles(commerceStarter())).forEach(([path, content]) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content) })
    server = Bun.spawn(['bun', join(import.meta.dir, '..', 'server', 'main.ts'), root, '--port', '0', '--no-open'], { stderr: 'pipe', stdout: 'ignore' })
    // The CLI prints its address on stderr once it listens.
    const reader = (server.stderr as ReadableStream<Uint8Array>).getReader()
    let output = ''
    while (!/at (http:\/\/\S+)/.test(output)) {
      const { value, done } = await reader.read()
      if (done) throw new Error(`server exited: ${output}`)
      output += new TextDecoder().decode(value)
    }
    url = output.match(/at (http:\/\/\S+)/)![1]
    reader.releaseLock()
    projectId = ((await (await fetch(`${url}/api/projects`)).json()) as { projects: Array<{ id: string }> }).projects[0].id
  })

  afterAll(() => {
    providers.forEach((provider) => provider.destroy())
    server?.kill()
    rmSync(root, { recursive: true, force: true })
  })

  const connect = (name: string) => {
    const doc = new Y.Doc()
    const provider = new WebsocketProvider(`${url.replace('http', 'ws')}/api/collab`, projectId, doc, { params: { name }, WebSocketPolyfill: WebSocket as never, disableBc: true })
    providers.push(provider)
    return { doc, synced: new Promise<void>((resolve) => provider.once('sync', () => resolve())) }
  }

  test('answers health for one project folder', async () => {
    expect(await (await fetch(`${url}/api/health`)).json()).toMatchObject({ server: 'c4sketch', auth: 'none', mode: 'single' })
  })

  test('two clients converge and an MCP edit reaches them', async () => {
    const alice = connect('Alice')
    const bob = connect('Bob')
    await Promise.all([alice.synced, bob.synced])
    const pa = readProject(alice.doc)!
    const pb = readProject(bob.doc)!
    writeProject(alice.doc, commands.patchElement(pa, 'container:web', { description: 'from Alice' }), pa)
    writeProject(bob.doc, commands.patchElement(pb, 'container:web', { technology: 'from Bob' }), pb)
    await until(() => readProject(alice.doc)!.elements['container:web'].technology === 'from Bob' && readProject(bob.doc)!.elements['container:web'].description === 'from Alice')

    const post = (body: unknown, session?: string) => fetch(`${url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...(session ? { 'mcp-session-id': session } : {}) }, body: JSON.stringify(body) })
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'smoke' }, capabilities: {} } })
    const session = init.headers.get('mcp-session-id')!
    const created = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_element', arguments: { name: 'Smoke System', kind: 'softwareSystem' } } }, session)).json() as { result: { isError: boolean; structuredContent: { result: { id: string } } } }
    expect(created.result.isError).toBe(false)
    const id = created.result.structuredContent.result.id
    await until(() => Boolean(readProject(alice.doc)!.elements[id]))
  })

  test('stopping saves the YAML folder and releases the lock', async () => {
    server!.kill('SIGTERM')
    await server!.exited
    const elements = readdirSync(join(root, 'elements')).map((name) => readFileSync(join(root, 'elements', name), 'utf8')).join('\n')
    expect(elements).toContain('from Alice')
    expect(elements).toContain('from Bob')
    expect(elements).toContain('Smoke System')
    expect(existsSync(join(root, '.lock'))).toBe(false)
  })
})

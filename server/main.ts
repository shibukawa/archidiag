#!/usr/bin/env bun
// c4sketch <project-dir>: starts the optional server on a project folder and opens the browser
// (requirement:bun-backend). --stdio also serves MCP on standard input and output for a local agent.
import { resolve } from 'node:path'
import { startServer, type TokenGrant } from './app'
import { SERVER_VERSION } from './mcp'
import { serveStdio } from './stdio'

const HELP = `c4sketch ${SERVER_VERSION}

Usage: c4sketch [project-dir] [options]

  project-dir            Folder holding c4sketch.yaml, or a workspace of project folders (default: .)
  --port <n>             HTTP port (default 8787)
  --host <address>       Bind address (default 127.0.0.1; anything else needs tokens)
  --token <name:secret[:read_only]>
                         A user of the shared mode; repeat for more users
  --workspace            Treat the folder as a workspace of projects
  --stdio                Also serve MCP on stdin/stdout for a local agent
  --no-open              Do not open the browser
  --allow-origin <url>   Another origin allowed to call the API
  --allow-anonymous      Share on the network without tokens
  --clear-stale-lock     Remove a lock left by a crashed server
  --static <dir>         Frontend build to serve (default: dist next to the server)
`

function parse(argv: string[]) {
  const options = { root: '.', port: 8787, host: '127.0.0.1', tokens: [] as TokenGrant[], workspace: false, stdio: false, open: true, allowedOrigins: [] as string[], allowAnonymous: false, clearStaleLock: false, staticDir: undefined as string | undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => { const next = argv[++index]; if (next === undefined) throw new Error(`${arg} needs a value`); return next }
    if (arg === '--help' || arg === '-h') { console.log(HELP); process.exit(0) }
    else if (arg === '--version') { console.log(SERVER_VERSION); process.exit(0) }
    else if (arg === '--port') options.port = Number(value())
    else if (arg === '--host') options.host = value()
    else if (arg === '--token') {
      const [name, token, role] = value().split(':')
      if (!name || !token) throw new Error('--token takes name:secret or name:secret:read_only')
      options.tokens.push({ name, token, role: role === 'read_only' ? 'read_only' : 'edit' })
    } else if (arg === '--workspace') options.workspace = true
    else if (arg === '--stdio') options.stdio = true
    else if (arg === '--no-open') options.open = false
    else if (arg === '--allow-origin') options.allowedOrigins.push(value())
    else if (arg === '--allow-anonymous') options.allowAnonymous = true
    else if (arg === '--clear-stale-lock') options.clearStaleLock = true
    else if (arg === '--static') options.staticDir = value()
    else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}\n\n${HELP}`)
    else options.root = arg
  }
  return options
}

/** Starts the server from command-line arguments; a compiled executable passes the frontend files it embeds. */
export function run(argv: string[], assets?: Map<string, Blob>) {
  try {
    const options = parse(argv)
    const running = startServer({ ...options, root: resolve(options.root), assets })
    console.error(`c4sketch ${SERVER_VERSION}: ${running.store.root} (${running.store.mode}) at ${running.url}${options.tokens.length ? ` for ${options.tokens.length} users` : ''}`)
    console.error(`MCP: ${running.url}/mcp${options.stdio ? ' and stdio' : ''}`)
    const shutdown = () => { running.stop(); process.exit(0) }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    process.on('SIGHUP', shutdown)
    if (options.stdio) serveStdio(running.mcp, () => shutdown())
    else if (options.open) {
      const opener = process.platform === 'darwin' ? ['open'] : process.platform === 'win32' ? ['cmd', '/c', 'start', ''] : ['xdg-open']
      try { Bun.spawn([...opener, running.url], { stdout: 'ignore', stderr: 'ignore' }) } catch { /* open it by hand */ }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (import.meta.main) run(process.argv.slice(2))

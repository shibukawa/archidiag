// MCP over stdio for a local agent started alongside the server: one JSON-RPC message per line on stdin, responses
// on stdout. Logs go to stderr so they never corrupt the stream.
import type { McpServer } from './mcp'

export function serveStdio(mcp: McpServer, onEnd: () => void) {
  const session = mcp.createSession({ id: 'local:agent', name: 'Local user', role: 'edit' }, 'stdio agent')
  const decoder = new TextDecoder()
  let buffer = ''
  const reply = (value: unknown) => { if (value !== undefined) process.stdout.write(`${JSON.stringify(value)}\n`) }
  ;(async () => {
    for await (const chunk of Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
        if (!line) continue
        let message: unknown
        try { message = JSON.parse(line) } catch { reply({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue }
        reply(await mcp.handle(message, session))
      }
    }
    onEnd()
  })()
}

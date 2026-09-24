import { toolDefinitions, type ToolDefinition, type ToolHost } from '../core/tools'

type ModelContext = { registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => Promise<void> | void }

/** Logs each accepted WebMCP edit to the browser console (requirement: webmcp-edit-logging). */
export function logWebMcpEdit(tool: string, action: string, payload: Record<string, unknown>) {
  console.log('[WebMCP edit]', { timestamp: new Date().toISOString(), source: 'WebMCP', tool, action, ...payload })
}

/** Registers the shared tool surface on document.modelContext when the browser provides it. Edits apply directly. */
export function registerWebMcpTools(host: ToolHost, onReady: (ready: boolean) => void): () => void {
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext
  if (!modelContext) { onReady(false); return () => {} }
  const controller = new AbortController()
  Promise.all(toolDefinitions(host).map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).then(() => onReady(true)).catch(() => onReady(false))
  return () => controller.abort()
}

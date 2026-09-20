---
id: decision:static-first-architecture
type: decision
title: Static-First Architecture
---
The baseline is a static browser application on GitHub Pages with the complete modeling feature set; only multi-user collaboration, server-side project storage, and the MCP server require system:bun-server.

```yaml
baseline:
  host: system:github-pages-host
  state: local browser state plus explicit project files
  backend_required: false
optional:
  collaboration: system:collaboration-service realized by system:bun-server
  ai: term:webmcp-integration in the browser, api:mcp-server on the server
  core: decision:shared-typescript-core keeps one command model for both
feature_parity:
  static_host_has: every diagram kind in term:diagram-family, vocabulary, domains, groups, perspectives, checks, undo, import and export, in-browser WebMCP, romaji and Chrome built-in AI name suggestions
  server_only: real-time collaboration, data:project-store, api:mcp-server, model providers that need configuration or credentials (decision:no-credentials-in-browser)
  rule: a feature that needs the server must degrade to a visible local alternative, never disappear silently
boundary:
  local_command_model is authoritative for validation, history, and UI updates
```

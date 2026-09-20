---
id: system:bun-server
type: system
title: Bun Server
---
The Bun server is an optional backend that adds the project store, the collaboration gateway, and the MCP server; every modeling feature already works on the static GitHub Pages build without it.

```yaml
runtime: Bun
serves:
  - static frontend assets (same build as system:github-pages-host)
  - api:collaboration-gateway over WebSocket
  - api:mcp-server over streamable HTTP, and stdio for local agents
  - data:project-store REST endpoints: list, open, save, snapshot, export
  - the same binary provides requirement:headless-cli
depends_on:
  - decision:shared-typescript-core
  - decision:server-authority-when-present
launch:
  local: bunx c4sketch <project-dir>; binds localhost, no login, opens the browser, serves that folder as data:project-store
  shared: bind a network address; login required; users get identities that edits and MCP sessions carry
configuration: bind address, project root directory, login provider or user tokens, allowed origins, model providers for system:name-suggestion-provider (API endpoints with keys, agent SDKs, local LLM endpoints) in a config file or environment
distribution: single executable via bun build --compile; container image
does_not_provide:
  - its own identity provider; multi-user login delegates to configured tokens or an external provider
  - a database; projects are files
```

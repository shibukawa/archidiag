---
id: system:github-pages-host
type: system
title: GitHub Pages Host
---
The GitHub Pages host serves the editor as static assets without requiring an application backend for core single-user editing.

```yaml
provides:
  - browser app assets with the full modeling feature set (decision:static-first-architecture)
  - project import and export
  - local browser persistence
  - in-browser WebMCP tools (term:webmcp-integration)
does_not_provide:
  - authoritative shared session state
  - server-side project store and MCP server (system:bun-server)
  - server-side secrets
depends_on:
  - decision:static-first-architecture
```

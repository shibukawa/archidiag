---
id: decision:shared-typescript-core
type: decision
title: Shared TypeScript Core
---
The project model, commands, validation, checks, and exports live in one runtime-neutral TypeScript package that runs unchanged in the browser and in system:bun-server, so every entry point applies the same rules.

```yaml
status: accepted 2026-09-20
core_package:
  contains: data:c4-project types, data:edit-operation commands and inverses, rule:c4-model-integrity, rule:check-evaluation, JSON, diagram, DDL, and document bundle exporters with data:sql-dialect-mapping, auto-layout engine, api:ai-tool-surface tool definitions
  excludes: DOM, React, Bun APIs, file system, network
consumers:
  browser: local command model for single-user editing and optimistic apply
  bun_server: authoritative apply for collaboration and MCP calls
rejected:
  browser_only_logic_with_relay_server: MCP could not work without an open browser tab
  separate_server_implementation: two validators drift
consequences:
  - exporters that need a canvas (png, pdf) run in the browser or in a headless renderer on the server
  - tool contracts in data:webmcp-tool-contract are generated once and reused by term:webmcp-integration and api:mcp-server
```

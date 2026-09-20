---
id: decision:server-authority-when-present
type: decision
title: Server Authority When Present
---
When a project is opened through system:bun-server, the server is the single authority that validates, orders, and persists operations; without a server the browser keeps the same authority locally.

```yaml
status: accepted 2026-09-20
with_server:
  apply: client applies optimistically, submits data:edit-operation with base_revision, server validates and assigns the next revision
  reject: server returns a descriptive error; client rolls back the optimistic change
  broadcast: accepted operations go to every participant and to MCP clients that subscribed
  persistence: data:project-store journal plus periodic snapshots
without_server:
  apply: local command model only; export and import remain the sharing path
offline:
  behavior: queue local operations, reconnect, rebase on the latest revision, surface conflicts per flow:collaborative-editing
rejected:
  first_browser_is_host: works for peer sessions but leaves headless MCP editing with no authority
consequences:
  - api:collaboration-gateway is implemented once over WebSocket in Bun
  - api:mcp-server writes go through the same apply path as browser edits, attributed to the attached user with an agent marker
  - undo is per participant (rule:undo-scope); the server validates inverse operations like any other
```

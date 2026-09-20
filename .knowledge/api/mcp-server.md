---
id: api:mcp-server
type: api
title: MCP Server
---
The MCP server exposes the api:ai-tool-surface tools, project resources, and check findings to external agents through the Model Context Protocol, making a coding agent another editor of the project with or without a browser open.

```yaml
transports:
  streamable_http: default for remote agents; bearer token
  stdio: local agents launched alongside the server
tools: same names, input schemas, and mutation kinds as api:ai-tool-surface and data:webmcp-tool-contract
resources:
  - project://<project_id>: portable JSON
  - project://<project_id>/diagram/<diagram_id>: diagram JSON or SVG
  - project://<project_id>/findings: rule:check-evaluation output
  - project://<project_id>/ddl/<data_store_id>: DDL in the store's dialect
  - project://<project_id>/bundle: document bundle (requirement:document-bundle-export)
session:
  - a tool call names the project; the server opens it through data:project-store
  - writes apply via decision:server-authority-when-present and broadcast to browser participants
  - the MCP client appears as an actor:ai-agent participant acting as the attached user (rule:ai-change-consent)
identity:
  local: no login; the agent is the local user
  shared: the MCP session is bound to a logged-in user's token; edits carry the user plus an agent marker and inherit the user's permissions
apply:
  - mutation tools apply directly; no proposal or approval step
  - every accepted write is logged per requirement:webmcp-edit-logging and undoable in connected browsers
constraints:
  - no tool bypasses validation or history
  - long-running exports return a resource link, not inline binary
```

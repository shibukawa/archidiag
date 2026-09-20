---
id: requirement:bun-backend
type: requirement
title: Optional Bun Backend
---
The product must ship an optional Bun server that serves the same frontend, stores projects as files, hosts real-time collaboration, and exposes an MCP server, while the static build keeps working without it.

```yaml
priority: v1
acceptance:
  - start the server with a project root directory and open the frontend from it; localhost needs no login
  - multi-user mode requires login; edits, presence, and MCP sessions carry that user's identity
  - list, create, open, and save projects through the YAML store; folders convert to and from the portable JSON file
  - two browsers editing one project converge through api:collaboration-gateway with presence and attribution
  - an MCP client can list tools, read a project resource, and apply an edit that appears live in connected browsers
  - bunx c4sketch <project-dir> starts a local server on the project's data folder and opens the browser; a project config file in that folder records the data layout
  - the same validation, checks, and command history run on the server as in the browser
  - the static build detects the server and falls back to local mode when absent; no modeling feature is gated on the server
  - build one executable and one container image
acceptance_providers:
  - model providers are declared in server config; the browser lists them by name and never handles credentials
non_goals:
  - user accounts and identity federation
  - a database backend in v1
depends_on:
  - system:bun-server
  - data:project-store
  - api:collaboration-gateway
  - api:mcp-server
  - decision:shared-typescript-core
  - decision:server-authority-when-present
  - decision:static-first-architecture
  - requirement:optional-collaboration
```

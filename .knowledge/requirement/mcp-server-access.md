---
id: requirement:mcp-server-access
type: requirement
title: MCP Server Access for External Agents
---
External agents must be able to inspect, check, and edit a project through MCP with the same tools as the in-browser WebMCP surface, applying edits directly as the attached user.

```yaml
priority: v1
user_story: As a developer, I run bunx c4sketch ./design in my repository, point Claude Code at the local server, ask it to add a container and its DFD flows, and watch them appear in my browser tab.
acceptance:
  - tool list and schemas match api:ai-tool-surface exactly
  - read tools and resources work without an open browser
  - mutation tools apply directly and broadcast; connected browsers show them live with agent attribution and can undo them
  - locally there is no login or restriction; in a shared session the agent acts as the logged-in user and inherits that user's permissions
  - findings resource returns the active profile's results (rule:check-evaluation)
  - an MCP client sees its own presence entry and revision after each write
  - unauthorized or malformed calls return descriptive errors and never partial mutations
depends_on:
  - api:mcp-server
  - api:ai-tool-surface
  - data:webmcp-tool-contract
  - rule:ai-change-consent
  - requirement:webmcp-edit-logging
  - requirement:bun-backend
```

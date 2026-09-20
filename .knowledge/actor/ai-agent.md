---
id: actor:ai-agent
type: actor
title: AI Agent
---
The AI agent is another editor of the project: it inspects and applies changes directly through the editor's WebMCP tool surface in the browser or through api:mcp-server on system:bun-server, acting as the user who attached it.

```yaml
uses:
  - requirement:ai-assisted-editing
  - api:ai-tool-surface
  - requirement:headless-cli
  - rule:ai-change-consent
```

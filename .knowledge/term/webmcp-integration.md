---
id: term:webmcp-integration
type: term
title: WebMCP Integration
---
WebMCP integration exposes typed, callable editor operations to browser agents while keeping the editor as the source of truth.

```yaml
surface: document.modelContext
tool_kinds:
  - read_only inspection
  - consequential mutation
compatibility: feature_detect and provide an in-app command fallback
caveat: WebMCP is an evolving browser API and must not be the only editor path
```

---
id: decision:webmcp-compatibility
type: decision
title: WebMCP Compatibility Strategy
---
Treat WebMCP as progressive enhancement: detect the available browser API, register tools when supported, and keep equivalent in-app commands for all users.

```yaml
implementation:
  preferred_surface: document.modelContext
  registration: lifecycle-scoped and abortable
  exposure: read_only inspection plus direct mutations with attribution
fallbacks:
  - command palette
  - importable operation file
  - conventional UI controls
risk: browser support and API shape may change before standardization
```

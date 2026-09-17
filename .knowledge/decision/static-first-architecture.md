---
id: decision:static-first-architecture
type: decision
title: Static-First Architecture
---
The baseline is a static browser application; collaboration and AI connectivity are optional adapters around the same local command model.

```yaml
baseline:
  host: system:github-pages-host
  state: local browser state plus explicit project files
  backend_required: false
optional:
  collaboration: system:collaboration-service
  ai: term:webmcp-integration
boundary:
  local_command_model is authoritative for validation, history, and UI updates
```

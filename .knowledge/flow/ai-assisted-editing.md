---
id: flow:ai-assisted-editing
type: flow
title: AI-Assisted Editing Flow
---
An AI agent reads the current model through WebMCP, proposes a bounded edit, and the user accepts or rejects the resulting diff.

```yaml
flow:
  trigger: actor:ai-agent requests work in ui:diagram-editor
  steps:
    - id: inspect
      action: call read_only tools from api:ai-tool-surface
    - id: propose
      action: create a bounded data:edit-operation proposal
    - id: preview
      action: show target scope, diff, validation result, and actor identity
    - id: accept
      action: apply accepted operations through the local command model
    - id: share
      action: broadcast accepted changes when a session exists
  failure:
    invalid_operation: return descriptive error without partial mutation
```

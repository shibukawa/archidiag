---
id: flow:single-user-editing
type: flow
title: Single-User Editing Flow
---
The diagram author edits a local project, validates it, and saves a portable copy without a backend.

```yaml
flow:
  trigger: actor:diagram-author opens system:github-pages-host
  steps:
    - id: open
      action: load local project or create data:c4-project
    - id: edit
      action: apply commands through ui:diagram-editor
    - id: validate
      action: run rule:c4-model-integrity
    - id: persist
      action: save browser state and optionally export a project file
  failure:
    storage_unavailable: offer explicit export
```

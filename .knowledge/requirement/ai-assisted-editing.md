---
id: requirement:ai-assisted-editing
type: requirement
title: AI-Assisted Editing Through WebMCP
---
The editor must expose enough typed operations for an AI agent to inspect, validate, and apply edits directly inside the same web interface, as one more editor.

```yaml
priority: v1
read_only_tools:
  - get_project_summary
  - list_diagrams
  - get_diagram
  - get_scope
  - enter_scope
  - validate_project
mutation_tools:
  - create_element
  - rename_element
  - update_element
  - delete_element
  - create_relationship
  - update_relationship
  - delete_relationship
  - apply_operation_batch
acceptance:
  - tools describe inputs and results with typed schemas
  - mutation calls apply immediately through the validated command path and appear in history with AI attribution
  - a batch call undoes as one step
  - AI targets canonical element ids when entering scopes or renaming
  - accepted AI changes use the same local command model as human edits
  - AI origin is visible and recorded in data:edit-operation
  - unsupported WebMCP browsers retain full manual editing
depends_on:
  - term:webmcp-integration
  - data:webmcp-tool-contract
  - data:edit-operation
  - rule:ai-change-consent
  - api:ai-tool-surface
```

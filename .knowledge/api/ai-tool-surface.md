---
id: api:ai-tool-surface
type: api
title: AI Tool Surface
---
The AI tool surface maps data:webmcp-tool-contract records to safe editor commands and uses the same validation and history path as the human UI.

```yaml
read_tools:
  - get_project_summary
  - list_diagrams
  - get_diagram
  - get_scope
  - enter_scope
  - validate_project
write_tools:
  - create_element
  - rename_element
  - update_element
  - delete_element
  - create_relationship
  - update_relationship
  - delete_relationship
  - apply_operation_batch
execution:
  registration: term:webmcp-integration
  validation: rule:c4-model-integrity
  consent: rule:ai-change-consent
  history: data:edit-operation
```

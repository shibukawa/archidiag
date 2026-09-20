---
id: api:ai-tool-surface
type: api
title: AI Tool Surface
---
The AI tool surface maps data:webmcp-tool-contract records to safe editor commands, is served both in-browser through term:webmcp-integration and remotely through api:mcp-server, and uses the same validation and history path as the human UI.

```yaml
read_tools:
  - get_project_summary
  - list_diagrams
  - get_diagram
  - get_scope
  - enter_scope
  - validate_project
  - list_entities: project-wide table catalog with filters
  - get_entity
  - list_vocabulary
  - list_domains
  - list_dfds
  - get_dfd
  - list_groups
  - list_perspectives
  - list_perspective_notes
  - list_check_profiles
  - get_check_findings
  - list_views
  - get_element_usage
  - get_link: deep link for any target (requirement:deep-links)
write_tools:
  - create_element
  - rename_element
  - update_element
  - delete_element
  - create_relationship
  - update_relationship
  - delete_relationship
  - create_entity
  - update_entity_attributes
  - create_entity_relationship
  - delete_entity
  - upsert_vocabulary_entry
  - suggest_names
  - upsert_domain
  - merge_domains
  - create_dfd
  - add_dfd_node
  - create_dfd_flow
  - delete_dfd
  - upsert_group
  - set_element_group
  - upsert_perspective
  - add_perspective_note: includes value for enum perspectives such as lifecycle and data_classification
  - set_active_check_profile
  - create_view
  - set_view_elements
  - arrange_view
  - export_bundle
  - apply_operation_batch
scoping:
  erd_tools: require a database or database_schema container id or an owner entity id (rule:erd-scope-integrity)
  vocabulary_tools: apply directly; suggestions from suggest_names are returned, not applied, until upsert_vocabulary_entry
  perspective_tools: bulk annotation across many targets is one batch that undoes as one
  dfd_tools: nodes reference canonical ids only (rule:dfd-reference-integrity)
execution:
  registration: term:webmcp-integration
  validation: rule:c4-model-integrity
  attribution: rule:ai-change-consent
  history: data:edit-operation
```

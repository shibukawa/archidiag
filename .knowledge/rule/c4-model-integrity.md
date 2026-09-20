---
id: rule:c4-model-integrity
type: rule
title: C4 Model Integrity
---
Every saved data:c4-project must preserve valid C4 scope, stable ids, resolvable relationship endpoints, and a diagram level from term:c4-diagram-level.

```yaml
rules:
  - every element id is unique within the project
  - every relationship source_id and target_id resolves
  - every diagram has exactly one kind from term:diagram-family and its scope element kind matches: erd_component needs a database or database_schema container, erd_code needs an entity, dfd_* per rule:dfd-c4-pairing
  - entity elements, attributes, and entity relationships obey rule:erd-scope-integrity
  - vocabulary bindings resolve per rule:vocabulary-resolution; domains resolve to data:data-domain
  - group_id obeys rule:group-membership; perspective notes resolve per data:perspective-note
  - dfd diagrams obey rule:dfd-reference-integrity
  - child scope belongs to its parent scope
  - every diagram element_ref resolves to one canonical element that belongs to the view's scope or its external context
  - each scope and kind has exactly one default data:diagram-view when any view exists
  - parent_id is valid for the element kind and diagram level
  - display names are resolved from canonical elements at render time
  - import rejects a schema_version newer than the application supports and migrates older ones (decision:project-schema-versioning)
  - validation reports errors without silently deleting user data
```

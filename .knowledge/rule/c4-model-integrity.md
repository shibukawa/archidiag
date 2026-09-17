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
  - every diagram has exactly one supported level
  - child scope belongs to its parent scope
  - every diagram element_ref resolves to one canonical element
  - parent_id is valid for the element kind and diagram level
  - display names are resolved from canonical elements at render time
  - import rejects unknown required schema versions
  - validation reports errors without silently deleting user data
```

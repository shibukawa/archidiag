---
id: data:diagram-view
type: data
title: Diagram View
---
A diagram view is one named diagram record of a kind and scope; a scope may own many views of the same kind, each selecting a subset of the scope's elements with its own layout.

```yaml
fields: id, kind, scope_id, name, description, is_default, element_refs, use_case, dfd_payload, layout, display_mode
display_mode: compact | descriptive | technology_only (requirement:description-display)
kind: term:diagram-family
element_refs:
  c4_and_erd: subset of the scope's child elements plus the external context they need; empty means all
  dfd: nodes reference elements per data:dfd-model
is_default: exactly one default view per scope and kind; navigation lands on it
naming:
  examples: "Container View: Commerce Platform (Payments)", "Component ERD: Orders (Billing tables)"
constraints:
  - views share canonical elements; adding to a view never copies a record
  - an element may appear in any number of views of its scope, including none
  - deleting a view deletes only its layout and membership
  - export title uses the view name
```

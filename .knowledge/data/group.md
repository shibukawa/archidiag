---
id: data:group
type: data
title: Group
---
A group is a named, nestable boundary inside one scope that organizes elements for microservice, team, or domain ownership without adding C4 semantics.

```yaml
fields: id, scope_id, parent_group_id, name, description, color (tint only, rule:diagram-styles)
scope_id: project root, software system, application container, or data store container
membership: an element joins by its optional group_id; its parent_id must equal the group's scope_id (rule:group-membership)
nesting: parent_group_id refers to a group of the same scope; no cycles
semantics:
  relationships: unchanged; a group is never a relationship endpoint
  validation: unchanged; groups do not affect rule:c4-model-integrity beyond membership
  navigation: not a scope; double-click selects the group, never enters it
rendering:
  canvas: dashed labeled boundary inside the scope boundary in c4_container, c4_component, and erd_component
  tree: intermediate node between the scope and its elements; collapsible
  dfd: hidden by default; optional overlay
examples:
  - Order Domain group of containers inside Commerce Platform
  - Platform Team group of software systems at root
  - Billing group of entities inside the Orders schema
```

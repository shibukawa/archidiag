---
id: data:perspective
type: data
title: Perspective
---
A perspective is a project-level cross-cutting concern, such as security or performance, under which notes are attached to any element, relationship, entity, group, or diagram.

```yaml
fields: id, name, description, icon, color, value_kind, values, styles, builtin
value_kind: free_text | enum
values: ordered enum values when value_kind is enum
styles: per value: outline dashed | solid, fill color, badge icon, label decoration; applied when a view activates this perspective's styling; shapes stay fixed by rule:diagram-styles
built_in:
  lifecycle: enum existing | planned | deprecated (decision:status-and-classification-as-perspectives)
  data_classification: enum public | internal | confidential | pii with rule:classification-propagation
  security, performance, availability, compliance, data_ownership, cost: free_text
notes: data:perspective-note
constraints:
  - names are unique within the project
  - a perspective changes rendering only through badges and its own style rules when activated on a view
  - built-in perspectives can be hidden but not deleted; their values are fixed
  - renaming or recoloring a perspective updates every badge
```

---
id: data:erd-model
type: data
title: ERD Scope Structure
---
The ERD scope structure defines which entities and relationships an erd_component diagram and an erd_code diagram contain.

```yaml
erd_component:
  scope: data store container
  shows: independent data:entity cards, data:entity-relationship among them, projected relationships to dependents
  hides: dependent entities behind a count badge on their owner
erd_code:
  scope: one independent or dependent entity
  shows: the scoped entity, its direct dependent entities, relationships among them, references leaving the group as external context
  nesting: a dependent entity may own further dependents; double-click zooms again
external_context:
  entities outside the scope that are referenced by visible relationships are shown collapsed outside the boundary, following rule:external-context-boundary
layout: per-view positions, collapsed attribute lists, boundary size
```

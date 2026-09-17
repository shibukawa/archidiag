---
id: rule:external-context-boundary
type: rule
title: External Context and System Boundary
---
Nested C4 views show relevant people and external systems outside the current system boundary while internal elements remain inside it.

```yaml
container_view:
  inside: containers belonging to the selected software system
  outside: root people and external systems connected to the selected system or its visible descendants
component_view:
  inside: components belonging to the selected container
  outside: relevant external context inherited from the owning system plus direct component dependencies
boundary:
  label: current scope name
  excludes: outside context elements
  growth: expand to contain internal elements moved beyond an edge
relationships:
  - preserve visible edges to external context
  - project inherited relationships to an explicit visible child endpoint when defined
  - omit relationships that would otherwise connect only to the boundary
  - never use the system boundary as a relationship endpoint
overlap:
  - relocate external context to the nearest valid side when boundary growth creates an overlap
```

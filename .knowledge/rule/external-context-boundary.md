---
id: rule:external-context-boundary
type: rule
title: External Context and System Boundary
---
Nested C4 views show relevant people and external systems outside the current system boundary while internal elements remain inside it.

```yaml
container_view:
  inside: containers belonging to the selected software system
  outside: root elements, including other software systems, connected to the selected system or its visible descendants
component_view:
  nesting: the software system boundary encloses the container boundary, like the C4 reference component diagram
  inside_container_boundary: components belonging to the selected container
  inside_system_boundary: sibling containers of the same software system that have a relationship with a visible component or its descendants; drawn as context
  outside_system_boundary: root elements (people, external systems, other software systems) with a direct relationship to a visible component or descendant
  pending: relationships that stop at the container itself are not drawn; their other end is still shown and placed by arrow direction until assigned to a component
boundary:
  label: current scope name in bold with its kind in brackets beneath, at the boundary's bottom-left corner (C4 convention); the boundary reserves space below its lowest element for it
  excludes: outside context elements
  growth: expand to contain internal elements moved beyond an edge
relationships:
  - preserve visible edges to external context
  - project inherited relationships to an explicit visible child endpoint when defined
  - omit relationships that would otherwise connect only to the boundary
  - a relationship that stops at the scope element is not drawn; its other end stays in the view, placed by arrow direction, until the relationship is assigned to a child (rule:nested-relationship-projection)
overlap:
  - relocate external context to the nearest valid side when boundary growth creates an overlap
```

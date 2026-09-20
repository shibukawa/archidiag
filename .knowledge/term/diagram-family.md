---
id: term:diagram-family
type: term
title: Diagram Family
---
Every diagram kind names its family and level: c4_* static structure, erd_* static data structure inside a data store, and dfd_* data flow and transaction scope per use case paired with a C4 level; the kind alone fixes scope element kind, rendering, and export title.

```yaml
diagram_kind: c4_context | c4_container | c4_component | erd_component | erd_code | dfd_context | dfd_container | dfd_component
c4:
  c4_context: scope project root; software systems, people, external systems; doubles as System Landscape (decision:c4-supplementary-diagrams)
  c4_container: scope software system; containers
  c4_component: scope application container; components
erd:
  erd_component: scope database or database_schema container; independent entities (term:erd-notation)
  erd_code: scope entity; the entity plus its dependent entities
  sibling_of: c4_component and the code level of term:c4-diagram-level; same zoom gesture, different content
dfd:
  dfd_context: pairs with c4_context; scope project root
  dfd_container: pairs with c4_container; scope software system
  dfd_component: pairs with c4_component; scope application container
  notation: term:dfd-notation; pairing: rule:dfd-c4-pairing
future: deploy_container (requirement:deployment-diagram)
overlays: data:group boundaries and data:perspective badges apply across kinds
frame: every kind renders rule:diagram-frame with its kind label
principle: a kind adds a view, never a second copy of an element (decision:no-logical-physical-split)
```

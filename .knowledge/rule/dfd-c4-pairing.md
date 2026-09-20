---
id: rule:dfd-c4-pairing
type: rule
title: DFD and C4 Pairing
---
Every DFD mirrors one C4 scope and level, and zooming a process node opens the next-level DFD of the same use case exactly like C4 drill-down.

```yaml
kind_scope:
  dfd_context: scope root; processes are software systems; pairs with c4_context
  dfd_container: scope software system; processes are its containers; pairs with c4_container
  dfd_component: scope application container; processes are its components; pairs with c4_component
roles_by_position:
  inside_scope: process, data_store, or intermediate_data by element kind (term:dfd-notation)
  outside_scope: external_entity, or data_store when the element is a data store container accessed by the scope
  data_store_at_component_level: data store container or its entities; entities give per-table operations
zoom:
  down: double-click a process node -> open the next kind (dfd_context -> dfd_container -> dfd_component) with scope_id = element and the same use_case; offer to create when absent
  up: breadcrumb returns to the parent DFD or the paired C4 view
  numbering: child processes inherit the parent number prefix
consistency:
  - a DFD flow between two elements without a C4 relationship in either direction is a warning that offers to create the relationship
  - deleting a C4 element lists DFDs where it appears
views: a DFD pairs with a scope and level, not with one data:diagram-view; the navigator shows the scope's C4 views and its DFDs together
side_by_side: the level navigator shows the paired C4 views and the DFD list for the current scope
```

---
id: decision:dfd-first-free-nodes
type: decision
title: DFD-First Free Nodes
---
A DFD node is either bound to a canonical element or free: created in the DFD first with its own name, drawn dashed, and placed into C4 or an ERD (or bound to an existing element) later, so authors can sketch a use case before the structure exists.

```yaml
status: accepted 2026-09-21
chosen:
  bound_node: element_ref set; name, description, technology resolve from the element; role derives from position per rule:dfd-c4-pairing
  free_node: no element_ref; own name, description, technology, role, intermediate kind; legend line "not yet placed"
  entry:
    model_first: drag an element from the explorer onto the DFD canvas; a bound node appears at the drop point; an element already present is selected instead
    dfd_first: quick create in a DFD asks for a role (process, data store, external entity, file, queue) and adds a free node
  placement: inspector offers "place into the model" with the element kinds the role allows (process -> component of an existing container, a new container, or the system's placeholder "Unknown container" per decision:dfd-drives-c4; data store -> table of an existing or new database; queue -> topic of an existing or new pubsub container; file -> folder of an existing or new bucket; external entity -> external system at the root) and "bind to existing element" listing elements that would take the same role (decision:dfd-component-granularity)
  unbind: a bound node can be detached and keeps the element's text as its own
  deletion: deleting an element turns its nodes into free nodes carrying the old name, so no DFD loses its picture
  numbering: a free node that becomes a process takes the next number; numbers are never reused
rejected:
  elements_without_parent: a parentless container or component breaks rule:c4-model-integrity and every scope-based query
  nodes_always_bound: forces authors to decide C4 structure before they can draw the use case
consequences:
  - data:dfd-model node element_ref is optional; free nodes carry their own text
  - data:check-item dfd.node_placed_in_model reports free nodes; profiles raise it toward export
  - rule:dfd-reference-integrity accepts free nodes; a bound node's role must still match its element
```

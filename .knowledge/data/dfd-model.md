---
id: data:dfd-model
type: data
title: DFD Model
---
The DFD model is a use-case diagram whose kind fixes its C4 level; it shows where data needed by a use case flows and where transaction boundaries lie, with nodes projecting canonical elements of data:c4-project and flows carrying entity payloads and CRUD operations.

```yaml
diagram:
  kind: dfd_context | dfd_container | dfd_component
  fields: id, name, use_case, scope_id, nodes, flows, transaction_boundaries, layout
  purpose: data reach, data ownership, and consistency scope; not execution order
  level: derived from kind; no separate field
  scope_id: project root for dfd_context, software system for dfd_container, application container for dfd_component
  use_case: scenario title, for example "Place order"
node:
  fields: id, role, element_ref, intermediate, diagram_ref, process_number, label_override, description, technology
  role: term:dfd-notation node_kinds
  element_ref: canonical element id for external_entity, process, data_store, and pubsub-backed intermediate_data
  intermediate: data:dfd-intermediate-data payload when no element backs the node
  diagram_ref: data:dfd-diagram-ref when role is diagram_ref
  process_number: p1, p1.1; derived from the parent DFD number when decomposed
flow:
  fields: id, source_node_id, target_node_id, label, description, data_refs, operations, technology
  data_refs: entity ids or free text
  operations: subset of C R U D, allowed only when one endpoint is a data_store
  ordering: none; a flow states that data may move, never when
transaction_boundaries: data:dfd-transaction-boundary list
pairing: rule:dfd-c4-pairing
layout: node positions, flow waypoints, boundary regions
constraints:
  - nodes never duplicate element records; labels resolve from canonical elements and vocabulary
  - one element may appear in many DFDs and several times in one DFD as external_entity
  - flows obey rule:dfd-connection-policy
```

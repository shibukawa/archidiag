---
id: data:dfd-model
type: data
title: DFD Model
---
The DFD model is a use-case diagram of one software system at container level; it shows where data needed by a use case flows and where transaction boundaries lie, with nodes projecting canonical elements of data:c4-project and flows carrying entity payloads and CRUD operations.

```yaml
diagram:
  kind: dfd_container (decision:dfd-container-level-only)
  fields: id, name, use_case, scope_id, nodes, flows, process_groups, transaction_boundaries, layout
  purpose: data reach, data ownership, and consistency scope; not execution order
  scope_id: the software system
  use_case: scenario title, for example "Place order"
node:
  fields: id, role, element_ref, name, description, technology, intermediate_kind, process_number, target_view_id
  role: term:dfd-notation node_kinds; exactly one start node per DFD
  element_ref: canonical element id of a bound node; absent on a free node (decision:dfd-first-free-nodes)
  name_description_technology: the free node's own text; a bound node resolves them from its element
  intermediate_kind: file | queue on intermediate_data
  target_view_id: the DFD an off-page diagram_ref continues in (data:dfd-diagram-ref)
  process_number: 1, 2, 3; the next free number of the DFD; never reused
flow:
  fields: id, source_node_id, target_node_id, label, description, data_refs, operations, technology, relationship_ref
  relationship_ref: optional id of the C4 relationship the flow was imported from (requirement:c4-links-into-dfd); the flow and the relationship draw as one line member
  data_refs: entity ids or free text
  operations: subset of C R U D, allowed only when one endpoint is a data_store
  ordering: none; a flow states that data may move, never when
process_groups: data:dfd-process-group list; a process node belongs to at most one
transaction_boundaries: data:dfd-transaction-boundary list
payload: nodes, flows, boundaries, next_number kept on the data:diagram-view as dfd
pairing: rule:dfd-c4-pairing
layout: node positions keyed by node id; boundary regions derive from the nodes their flows touch
constraints:
  - bound nodes never duplicate element records; labels resolve from canonical elements and vocabulary
  - one element appears at most once per DFD through the drag-and-drop path; a second drop selects the existing node
  - flows obey rule:dfd-connection-policy
```

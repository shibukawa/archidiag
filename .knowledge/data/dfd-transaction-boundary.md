---
id: data:dfd-transaction-boundary
type: data
title: DFD Transaction Boundary
---
A transaction boundary is a named region on a DFD that marks which flows and stores must succeed or fail together, so the diagram shows where consistency is guaranteed and where it is not.

```yaml
fields: id, dfd_id, name, member_flow_ids, description, consistency
member_flow_ids: flows inside the boundary; the processes and stores they touch are enclosed by rendering
consistency: atomic | eventual
rendering: dashed rounded region with the name; overlapping boundaries are allowed
derived_checks (data:check-item dfd.atomic_boundary_single_store, dfd.atomic_boundary_no_queue):
  - an atomic boundary that touches stores of two different data store containers is flagged as a distributed transaction
  - an atomic boundary that includes a queue intermediate_data is flagged as crossing an asynchronous hop
constraints:
  - members belong to the same DFD
  - a boundary never changes flow topology or rule:dfd-connection-policy
  - deleting a member flow removes it from the boundary; an empty boundary is a warning
```

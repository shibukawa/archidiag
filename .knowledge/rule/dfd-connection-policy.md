---
id: rule:dfd-connection-policy
type: rule
title: DFD Connection Policy
---
Flows connect processes with data nodes or external entities; direct process-to-process and store-to-store flows are repaired by inserting an intermediate node.

```yaml
classes:
  process: role process
  data: role data_store, intermediate_data
  external: role external_entity
  ref: role diagram_ref, takes the class of its target node
allowed:
  - process <-> data
  - process <-> external
  - data <-> external
forbidden:
  process_to_process: insert data:dfd-intermediate-data (file | queue)
  data_to_data: insert or select a process between them
operations:
  process_to_store: C U D allowed, default C
  store_to_process: R
  store_endpoint_label: union of operations shown at the store end
constraints:
  - every persisted flow has an allowed endpoint pair after repair
  - labels describe operation notes, never conditions or ordering
```

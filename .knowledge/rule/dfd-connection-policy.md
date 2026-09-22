---
id: rule:dfd-connection-policy
type: rule
title: DFD Connection Policy
---
Flows connect processes with data nodes or external entities; a direct process-to-process link groups the two into one logical process and inserts intermediate data between them, and a store-to-store flow gets a process inserted.

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
  process_to_process: group the two into a data:dfd-process-group and insert data:dfd-intermediate-data between them, api_document by default, file or queue by choice (decision:dfd-logical-process-group); the flow is never stored process to process
  data_to_data: insert or select a process between them
group_as_process: a data:dfd-process-group takes the process class from outside; inside it every hop is process -> intermediate data -> process
handled_document: an api_document bound to a passthrough component is data toward processes and its component toward stores, so it may read and write tables directly (decision:dfd-passthrough-components)
operations:
  process_to_store: C U D allowed, default C
  store_to_process: R
  store_endpoint_label: union of operations shown at the store end, stated once per process group
constraints:
  - every persisted flow has an allowed endpoint pair after repair
  - labels describe operation notes, never conditions or ordering
```

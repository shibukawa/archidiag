---
id: data:store-item
type: data
title: Store Item
---
A store item is the component-level child of a non-SQL data store container: a topic of a pubsub or queue container, a folder of a bucket or file share; it is what a DFD queue or file node binds to, as a table is what a store node binds to (decision:dfd-component-granularity).

```yaml
kinds:
  topic: parent pubsub | queue container; fields id, name, description, payload_refs (entity ids or free text naming the message), retention, ordering
  folder: parent bucket | file_share container; fields id, name, description, format, retention
navigation: double-click a pubsub, queue, bucket, or file_share container opens its item list, the data store's component view (term:diagram-family erd_component sibling), items drawn as cards
dfd: a topic backs an intermediate_data node of kind queue, a folder one of kind file (data:dfd-intermediate-data element_ref)
constraints:
  - item names are unique within one container
  - items have no attributes or relationships; message shape is described by payload_refs, not modelled
  - deleting the container deletes its items; DFD nodes bound to them become free nodes (decision:dfd-first-free-nodes)
```

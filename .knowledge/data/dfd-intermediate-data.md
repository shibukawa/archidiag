---
id: data:dfd-intermediate-data
type: data
title: DFD Intermediate Data
---
Intermediate data makes the transferred representation between two processes explicit as a file or a queue instead of allowing direct process-to-process flows.

```yaml
fields: id, name, kind, format, description, element_ref
kind:
  file: physical file, document, email, or API payload; folded-corner shape
  queue: asynchronous queued data or events; horizontal cylinder shape
element_ref: optional pubsub data store container that realizes a queue
mapping:
  api_payload: file
  stream_or_event: queue
  pubsub_container: queue with element_ref
creation: connecting two processes prompts for file or queue and inserts this node with two flows
constraints:
  - an event cannot be a standalone node; it is a queue
  - a queue backed by a pubsub container renames with the container
```

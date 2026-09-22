---
id: data:dfd-intermediate-data
type: data
title: DFD Intermediate Data
---
Intermediate data makes the representation handed between two processes explicit as an API document, a file, or a queue, so a DFD never draws a process-to-process flow: inside a logical process group every hop is process -> intermediate data -> process (decision:dfd-logical-process-group).

```yaml
fields: id, name, kind, format, description, element_ref
kind:
  api_document: request or response payload of a synchronous call (JSON document, form post, RPC message); folded-corner document with a braces badge; the default between two processes
  file: a file handed over (CSV, export, report, upload); folded-corner document with a file badge; typical UI -> batch or batch -> batch hand-off
  queue: asynchronous queued data or events; horizontal cylinder
format: free text such as JSON, CSV, Parquet, Avro; drawn in brackets like a technology
element_ref: optional element realizing the node: a topic for a queue, a folder for a file (data:store-item), or a passthrough component (a controller) for an api_document, drawn as "handled by" (decision:dfd-passthrough-components)
mapping:
  api_call: api_document
  file_exchange: file
  stream_or_event: queue
  topic: queue with element_ref
  folder: file with element_ref
creation: connecting two processes groups them into a data:dfd-process-group and inserts this node between them, api_document by default; the chooser offers file and queue instead
constraints:
  - an event cannot be a standalone node; it is a queue
  - a node backed by a topic or folder renames with it; a document handled by a component keeps its own name and shows the component beneath
  - an intermediate node is transient: it belongs to the group it sits in and is not a data store of the system
```

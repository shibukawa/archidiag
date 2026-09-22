---
id: decision:dfd-component-granularity
type: decision
title: DFD Nodes Are Component-Level
---
Every DFD node is a component-level thing: processes are components (logical functions), stores are tables, queues are topics, files are folders; containers never appear as nodes because a container is a deployment unit, and drawing it as a process would push authors toward splitting programs into an ill-judged microservice grid.

```yaml
status: accepted 2026-09-21
refines: decision:dfd-container-level-only
chosen:
  scope: still one software system per DFD; the level of the nodes is component, the level of the scope is system
  process: a component of any application container of the system, or a free node that becomes one (decision:dfd-drives-c4); the kind line names the container it is deployed in
  data_store: an independent data:entity (table, view) of a database or schema container; never the database itself; a dependent entity (a detail table, code level) folds into its owner, so dropping Order Line binds the Order table and the lines ride as data_refs on the flow
  intermediate_queue: a topic of a pubsub or queue container (data:store-item); a free queue node becomes one
  intermediate_file: a folder of a bucket or file_share container (data:store-item); a free file node becomes one
  api_document: transient; never an element
  external_entity: an external system, or a component of another system; the start marker replaces people (requirement:dfd-flow-direction)
  container_role: grouping and deployment only: kind lines, the C4 tree, and the derived container-to-container relationships
  placement_of_free_nodes: process -> component of an existing container, a new container, or the placeholder "Unknown container"; store -> table of an existing or new database; queue -> topic of an existing or new pubsub container; file -> folder of an existing or new bucket
rejected:
  containers_as_processes: a deployment unit is not a function; the picture would reward carving containers to make the DFD read well
  databases_as_stores: hides which tables the use case reaches and loses per-table C/R/U/D
  detail_tables_as_stores: a dependent table is code-level detail; drawing it doubles every write and says nothing about ownership
  raw_queues_and_buckets: a queue container without topics, or a bucket without folders, cannot say what data moves
consequences:
  - data:c4-project gains topic and folder element kinds under pubsub, queue, bucket, and file_share containers (data:store-item)
  - rule:dfd-c4-pairing roles are rewritten at component granularity
  - decision:dfd-logical-process-group representative order reads screen component > worker component > upstream component
  - decision:dfd-drives-c4 derives component -> table flows as component -> database container relationships in C4, since C4 relationships stop at the store (rule:erd-scope-integrity)
  - data:starter-project Place order uses Checkout Page, Order Controller, Checkout Service, Order Repository, the Orders tables, the order-placed topic, and the worker's component
```

---
id: term:dfd-notation
type: term
title: DFD Notation
---
A DFD shows where the data of one use case moves between external entities, processes, data stores, and intermediate data, and where transaction boundaries lie; it captures the rough flow of a use case but has no ordering and is not one-to-one with a dynamic or sequence diagram.

```yaml
notation: gane_sarson
node_kinds:
  external_entity: person, external system, or any element outside the current scope
  process: element that transforms or routes data; numbered p1, p1.1
  data_store: data store container or entity
  intermediate_data: data:dfd-intermediate-data (file | queue) between processes
  diagram_ref: data:dfd-diagram-ref off-page link to another DFD
flow:
  fields: label, data_refs, operations, technology
  direction: single; bidirectional exchange is two flows
  semantics: possible normal-case movement; no control flow, branching, ordering, or request/response pairing
boundary: data:dfd-transaction-boundary marks flows that succeed or fail together
kinds:
  dfd_context: scope project root; processes are software systems
  dfd_container: scope software system; processes are containers
  dfd_component: scope application container; processes are components
projection_from_model:
  person: external_entity
  external_system: external_entity
  software_system: process at context level, external_entity elsewhere
  application_container: process at container level, external_entity at component level
  component: process at component level
  data_store_container_database: data_store
  data_store_container_pubsub_or_queue: intermediate_data queue
  data_store_container_bucket_or_file_share: intermediate_data file when it carries transfer data, otherwise data_store
  entity: data_store at component level, or data payload on a flow
topology: rule:dfd-connection-policy
styles: rule:diagram-styles; frame: rule:diagram-frame; routing: rule:edge-routing
```

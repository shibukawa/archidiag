---
id: term:dfd-notation
type: term
title: DFD Notation
---
A DFD shows where the data of one use case moves between external entities, processes, data stores, and intermediate data, and where transaction boundaries lie; it captures the rough flow of a use case but has no ordering and is not one-to-one with a dynamic or sequence diagram.

```yaml
notation: gane_sarson
node_kinds:
  start: the user's action that begins the use case; one filled circle at the far left, flows only out to the first process (requirement:dfd-flow-direction)
  external_entity: external system or any element outside the current scope; never a person, whose action is the start marker and whose screen is the first process
  process: a component that transforms or routes data; numbered 1, 1.1 (decision:dfd-component-granularity)
  process_group: data:dfd-process-group, a pseudo-component enclosing directly connected processes as one logical process; nested groups with collapse and expand are the DFD's levels (decision:dfd-logical-process-group)
  data_store: a table (data:entity)
  intermediate_data: data:dfd-intermediate-data (api_document | file | queue) between processes; the only thing that ever joins two processes; a queue binds to a topic and a file to a folder (data:store-item)
  diagram_ref: data:dfd-diagram-ref off-page link to another DFD
flow:
  fields: label, data_refs, operations, technology
  direction: single; a response is implied by its request and not drawn unless the answer feeds a different service (requirement:dfd-flow-direction)
  semantics: possible normal-case movement; no control flow, branching, ordering, or request/response pairing
boundary: data:dfd-transaction-boundary marks flows that succeed or fail together
kinds:
  dfd_container: scope software system; processes are its application containers (decision:dfd-container-level-only)
projection_from_model:
  person: no node; a drop connects start -> the UI process the person uses (requirement:dfd-flow-direction)
  external_system: external_entity
  software_system: external_entity
  application_container: no node (deployment unit); its components are the processes
  component_of_scope_system: process (a screen and its operator, a handler, a job)
  other_component: external_entity
  data_store_container: no node; its tables, topics, or folders are the nodes
  entity: data_store when independent; a dependent entity folds into its owner and rides as a data payload on the flow
  topic: intermediate_data queue
  folder: intermediate_data file
topology: rule:dfd-connection-policy
styles: rule:diagram-styles; frame: rule:diagram-frame; routing: rule:edge-routing
```

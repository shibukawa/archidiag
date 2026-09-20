---
id: rule:dfd-reference-integrity
type: rule
title: DFD Reference Integrity
---
DFD nodes, payloads, and diagram references must resolve to canonical records so C4, ERD, and vocabulary edits propagate to every DFD without dangling flows.

```yaml
nodes:
  - element_ref resolves to a person, software system, container, component, or entity
  - role matches the element kind and position per rule:dfd-c4-pairing
  - intermediate_data nodes have a kind; queue may reference a pubsub container
  - diagram_ref nodes resolve per data:dfd-diagram-ref
flows:
  - endpoints are nodes of the same DFD and satisfy rule:dfd-connection-policy
  - each flow has a label, a data_ref, or an operation
  - data_refs resolve to data:entity ids or are free text
  - operations appear only on flows touching a data_store
boundaries:
  - data:dfd-transaction-boundary members are flows of the same DFD
propagation:
  - rename of any referenced element or vocabulary entry updates labels
  - deleting a referenced element lists affected DFDs and removes their nodes and flows only after confirmation
level:
  - kind and scope_id agree: dfd_context has root, dfd_container a software system, dfd_component an application container; a process element belongs to the scope
  - a child DFD's scope element is a process node of the parent DFD
```

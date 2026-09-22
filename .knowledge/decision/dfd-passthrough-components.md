---
id: decision:dfd-passthrough-components
type: decision
title: Pass-Through Components Bind to the Document They Handle
---
A component that only routes, validates, adapts, or persists (a controller, gateway, adapter, handler, repository) is not a DFD process, because a process transforms data and a router or a repository adds nothing to the picture: a controller binds to the request document it receives, and a repository is not drawn at all because the process writes its tables directly, so the DFD reads screen -> request (handled by Order Controller) -> service -> tables while the C4 model keeps the controller, the repository, and their links.

```yaml
status: accepted 2026-09-21
chosen:
  passthrough_flag: a component may be marked passthrough (data:c4-project component field); controllers, routers, gateways, adapters, repositories and DAOs
  repositories: never drawn; a process reads and writes its tables directly with C/R/U/D at the store end, the repository being implied; dropping a repository onto a DFD is refused with that hint
  handled_document_and_stores: a document handled by a passthrough component may still touch stores directly when an author wants it (rule:dfd-connection-policy), but the starter does not
  derivation_through_passthrough: a direct process -> store (or process -> process) flow derives no C4 line when a stored path process -> passthrough component -> store already explains it; the stored path is the truth
  dfd_role: a passthrough component dropped onto a DFD becomes an intermediate_data node of kind api_document bound to it (element_ref), not a process; the author may override the role per node either way
  reading: the document node shows the component's name as "handled by" under the document name; the request itself keeps its own name
  derivation: a flow A -> document(bound to C) -> B derives C4 relationships A -> C and C -> B, not A -> B (decision:dfd-drives-c4); an unbound document still derives A -> B
  import: when C4 holds A -> C and C -> B with C passthrough, requirement:c4-links-into-dfd offers the chain as one hop A -> document(C) -> B
  grouping: the bound document is a member of the logical process group like any intermediate data; it is never a unit, never numbered, never a representative (data:dfd-process-group)
  placement: a free api_document node can be placed as a passthrough component of an existing or new container (decision:dfd-first-free-nodes)
rejected:
  controller_as_process: a numbered box that only forwards the request; it doubles every hop and says nothing about data
  hide_controller_entirely: loses the C4 links through it, so the Component view would show screen -> service which is not how the code is wired
  special_node_kind: an "endpoint" node kind would duplicate api_document; binding the document is enough
consequences:
  - data:c4-project components gain passthrough
  - data:dfd-intermediate-data element_ref may be a passthrough component for api_document
  - rule:dfd-c4-pairing roles_by_position gains passthrough_component: intermediate_data api_document
  - decision:dfd-drives-c4 derivation and requirement:c4-links-into-dfd import handle the bound document
  - data:starter-project Place order: Order Controller handles the checkout request and Order Repository handles the order aggregate; neither is a numbered process
```

---
id: flow:dfd-authoring
type: flow
title: DFD Authoring Flow
---
The author creates a use-case DFD at container level, populates it from model elements, repairs flows through intermediate data, zooms a process into a component-level DFD, and links overflow to another diagram.

```yaml
flow:
  trigger: actor:diagram-author chooses "New DFD" for the current scope in ui:diagram-editor
  steps:
    - id: define
      action: enter name and use case; kind and scope derive from the current C4 view (c4_container -> dfd_container) per data:dfd-model
    - id: pick_nodes
      action: search the model tree and add containers, people, external systems, and data stores; roles derive from rule:dfd-c4-pairing
    - id: draw_flows
      action: drag the link handle; process-to-process prompts file or queue per rule:dfd-connection-policy
    - id: annotate
      action: set label, entity payloads, and CRUD operations at store ends
    - id: mark_transactions
      action: select the flows that must succeed together and draw a data:dfd-transaction-boundary; review distributed-transaction warnings
    - id: reconcile
      action: run rule:dfd-reference-integrity; accept offers to create missing C4 relationships
    - id: zoom
      condition: a process needs detail
      action: double-click the process to create the component-level DFD of the same use case
    - id: link
      condition: the diagram grows too large
      action: add a data:dfd-diagram-ref node and continue in another DFD
    - id: exit
      action: breadcrumb returns to the parent DFD or the paired C4 view
  failure:
    dangling_reference: block save and point to the missing element
    incompatible_role: reject the override and explain the allowed roles for the element kind
```

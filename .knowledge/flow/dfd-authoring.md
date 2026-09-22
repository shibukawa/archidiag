---
id: flow:dfd-authoring
type: flow
title: DFD Authoring Flow
---
The author creates a use-case DFD for a software system, populates it from model elements and free nodes, groups process chains or materializes intermediate data, marks transactions, and links overflow to another diagram.

```yaml
flow:
  trigger: actor:diagram-author chooses "New DFD" for the current scope in ui:diagram-editor
  steps:
    - id: define
      action: enter the use case from the system's Container view; the scope is that software system (decision:dfd-container-level-only)
    - id: pick_nodes
      action: drag containers, people, external systems, and data stores from the explorer onto the canvas; roles derive from rule:dfd-c4-pairing
    - id: sketch_free
      condition: the structure does not exist yet
      action: quick create a free process, store, external entity, file, or queue; place it into the model or bind it to an element later (decision:dfd-first-free-nodes)
    - id: draw_flows
      action: drag the link handle; process-to-process groups the two into one logical process with an API document between them, or a file or queue when chosen, per rule:dfd-connection-policy
    - id: annotate
      action: set label, entity payloads, and CRUD operations at store ends
    - id: mark_transactions
      action: select the flows that must succeed together and draw a data:dfd-transaction-boundary; review distributed-transaction warnings
    - id: reconcile
      action: run rule:dfd-reference-integrity; place free processes into containers or the placeholder so the derived C4 relationships appear (decision:dfd-drives-c4)
    - id: link
      condition: the diagram grows too large
      action: add a data:dfd-diagram-ref node and continue in another DFD
    - id: exit
      action: breadcrumb returns to the system's Container view
  failure:
    dangling_reference: block save and point to the missing element
    incompatible_role: reject the override and explain the allowed roles for the element kind
```

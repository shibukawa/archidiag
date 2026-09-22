---
id: requirement:use-case-dfd
type: requirement
title: Use-Case Data Flow Diagrams Paired with C4 Levels
---
Authors must be able to create many use-case DFDs per software system, at container level, that show where a use case's data flows from the user's action to the stores and where its transaction boundaries are, reuse C4 elements and entities, and link large diagrams through off-page references.

```yaml
priority: v1
user_story: As an author, I create a "Place order" DFD for the Commerce Platform showing the customer, the storefront, the Order Service, the payment provider, the Orders tables, and the worker that confirms the order.
acceptance:
  - create a DFD with a use case from a Container view; its scope is that software system; list DFDs in the explorer grouped by system
  - the level navigator shows the system's Container views and its DFDs side by side
  - add nodes by dragging elements from the explorer onto the canvas; roles derive from rule:dfd-c4-pairing
  - quick create adds a free node with a chosen role; the inspector places it into C4 or an ERD or binds it to an existing element later (decision:dfd-first-free-nodes)
  - connect nodes with a link handle; forbidden pairs are repaired per rule:dfd-connection-policy
  - connecting two processes groups them into a data:dfd-process-group named by its UI, else batch, else upstream member, and inserts data:dfd-intermediate-data between them (API document by default, file or queue by choice); a pubsub container is offered as a queue
  - a group collapses to one numbered process and expands to its members; nested groups number 1.1, 1.1.1
  - flows carry a label, optional entity payloads, and optional CRUD operations at store ends; flows have no order
  - draw a named transaction boundary around selected flows and mark it atomic or eventual
  - validation flags an atomic boundary that spans two data stores or crosses a queue
  - double-click a bound node to open its element's own scope; breadcrumb returns to the Container view
  - processes are numbered automatically and stay stable on edit
  - add a diagram reference node to continue a flow in another DFD; double-click navigates
  - flows between bound nodes derive C4 relationships, drawn as one line per pair with the contributing flows listed inside; placing a component into a container or the placeholder "Unknown container" grows the C4 tree (decision:dfd-drives-c4)
  - a stored 1:1 component relationship is offered for import as a hop when both components are on the DFD (requirement:c4-links-into-dfd)
  - the inspector lists DFDs that reference the selected element
  - validate with rule:dfd-reference-integrity and show issues in the validation panel
  - persist DFDs and layout in project JSON and round-trip through import
  - export as JSON, PDF, draw.io, PNG, and SVG with title "DFD: <use case> / <system>"
non_goals:
  - one-to-one replacement of C4 dynamic or sequence diagrams; the rough flow is visible but order, control flow, branching, and timing are not represented
  - simulation or execution
depends_on:
  - term:dfd-notation
  - term:diagram-family
  - data:dfd-model
  - data:dfd-intermediate-data
  - data:dfd-process-group
  - decision:dfd-logical-process-group
  - data:dfd-diagram-ref
  - data:dfd-transaction-boundary
  - data:entity
  - data:c4-project
  - rule:dfd-c4-pairing
  - rule:dfd-connection-policy
  - rule:dfd-reference-integrity
  - decision:dfd-container-level-only
  - decision:dfd-first-free-nodes
  - decision:dfd-drives-c4
  - requirement:c4-links-into-dfd
  - requirement:three-c4-layers
  - requirement:erd-in-data-store
  - ui:diagram-editor
```

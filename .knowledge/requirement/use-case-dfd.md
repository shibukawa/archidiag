---
id: requirement:use-case-dfd
type: requirement
title: Use-Case Data Flow Diagrams Paired with C4 Levels
---
Authors must be able to create many use-case DFDs at context, container, and component level that show where a use case's data flows and where its transaction boundaries are, reuse C4 elements and entities, zoom between levels like C4, and link large diagrams through off-page references.

```yaml
priority: v1
user_story: As an author, I create a "Place order" container-level DFD for the Commerce Platform, then double-click the Order Service process to detail the same use case among its components and the Orders tables.
acceptance:
  - create a DFD with name and use case; its kind (dfd_context, dfd_container, dfd_component) and scope derive from the current C4 view; list DFDs in the explorer grouped by scope and use case
  - the level navigator shows the paired C4 view and the DFDs for the current scope
  - add nodes by picking elements from the model tree or search; roles derive from rule:dfd-c4-pairing
  - connect nodes with a link handle; forbidden pairs are repaired per rule:dfd-connection-policy
  - connecting two processes prompts file or queue and inserts data:dfd-intermediate-data; a pubsub container is offered as a queue
  - flows carry a label, optional entity payloads, and optional CRUD operations at store ends; flows have no order
  - draw a named transaction boundary around selected flows and mark it atomic or eventual
  - validation flags an atomic boundary that spans two data stores or crosses a queue
  - double-click a process to open or create the next-kind DFD (dfd_container -> dfd_component) of the same use case; breadcrumb returns
  - processes are numbered automatically and stay stable on edit
  - add a diagram reference node to continue a flow in another DFD; double-click navigates
  - warn on flows with no matching C4 relationship and offer to create it
  - the inspector lists DFDs that reference the selected element
  - validate with rule:dfd-reference-integrity and show issues in the validation panel
  - persist DFDs and layout in project JSON and round-trip through import
  - export as JSON, PDF, draw.io, PNG, and SVG with title "<level> DFD: <use case> / <scope>"
non_goals:
  - one-to-one replacement of C4 dynamic or sequence diagrams; the rough flow is visible but order, control flow, branching, and timing are not represented
  - simulation or execution
depends_on:
  - term:dfd-notation
  - term:diagram-family
  - data:dfd-model
  - data:dfd-intermediate-data
  - data:dfd-diagram-ref
  - data:dfd-transaction-boundary
  - data:entity
  - data:c4-project
  - rule:dfd-c4-pairing
  - rule:dfd-connection-policy
  - rule:dfd-reference-integrity
  - decision:context-level-dfd
  - requirement:three-c4-layers
  - requirement:erd-in-data-store
  - ui:diagram-editor
```

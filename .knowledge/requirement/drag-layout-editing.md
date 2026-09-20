---
id: requirement:drag-layout-editing
type: requirement
title: Drag Diagram Elements
---
Authors must be able to drag elements on the canvas and persist their layout for the current diagram view.

```yaml
priority: mvp
acceptance:
  - drag an element without entering its child scope
  - drag people and external systems outside the current boundary
  - update its diagram-specific position during the drag
  - resize the current system boundary with a visible resize handle
  - auto-expand the boundary when an internal element crosses its edge
  - auto-relocate outside elements to a non-overlapping side of the boundary
  - keep relationships attached after movement; ports follow rule:edge-routing for the diagram family
  - save boundary size locally per diagram view
  - save positions locally and include them in project export
  - undo and redo a completed drag as one layout operation
  - retain separate positions for the same canonical element across views
depends_on:
  - data:c4-project
  - ui:diagram-editor
```

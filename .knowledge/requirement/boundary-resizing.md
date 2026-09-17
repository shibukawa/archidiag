---
id: requirement:boundary-resizing
type: requirement
title: Resize System Boundaries
---
Authors must be able to resize the system boundary independently for each nested diagram view.

```yaml
priority: mvp
interaction:
  handle: bottom_right
  minimum: width 420, height 300
  maximum: none; canvas expands with the boundary
acceptance:
  - resize the boundary by dragging its visible handle
  - automatically expand the boundary when an internal element is moved beyond an edge
  - keep the boundary around internal elements while external context remains outside
  - relocate an external element when boundary growth or resizing would overlap it
  - persist width and height in the local project layout for the current scope
  - include the resized boundary in PDF, draw.io, PNG, and SVG exports
  - undo and redo a completed resize as one layout operation
depends_on:
  - data:c4-project
  - rule:external-context-boundary
  - requirement:drag-layout-editing
```

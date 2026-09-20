---
id: requirement:layout-helpers
type: requirement
title: Manual Layout Helpers
---
Authors must be able to tidy a selection with alignment, distribution, and arrangement helpers such as lining elements up in one row, without running a full automatic layout.

```yaml
priority: v1
selection: two or more nodes of the current view; groups and boundaries follow their members
helpers:
  align: left, horizontal_center, right, top, vertical_center, bottom
  distribute: equal horizontal gaps, equal vertical gaps
  arrange: one row, one column, grid with a chosen column count; order follows flow direction on DFDs (rule:edge-routing), otherwise current position, then name
  size: match width, match height (entity cards keep content height)
  snap: optional grid snapping and alignment guides while dragging
  space: increase or decrease spacing of the selection uniformly
interaction:
  - toolbar group and context menu on a multi-selection; keyboard shortcuts for the common ones
  - each helper is one undoable layout operation
  - helpers keep external context outside the boundary and expand boundaries per rule:external-context-boundary
  - helpers never touch model data
acceptance:
  - select three containers and put them in one row with equal gaps in one action
  - align the tops of external entities on a DFD and distribute them evenly
  - arrange the tables of a data store in a three-column grid
  - alignment guides appear while dragging near another node's edge or center
  - helpers are available on every diagram kind
depends_on:
  - data:diagram-view
  - requirement:drag-layout-editing
  - requirement:auto-layout
  - rule:external-context-boundary
  - rule:edge-routing
```

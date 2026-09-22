---
id: requirement:auto-layout
type: requirement
title: Automatic Layout
---
Authors must be able to auto-arrange a view on demand and get sensible initial placement for new elements, while saved manual layouts stay authoritative until the author asks to re-layout.

```yaml
priority: v1
engine: layered graph layout (ELK or dagre class) running in the shared core; deterministic for the same input; DFD runs honor the side-port rule of rule:edge-routing
triggers:
  initial: a new view or an element added without a position gets a non-overlapping placement near related elements
  on_demand: "Arrange" action for the whole view or the selection
  never: silently on load, rename, or model change
per_kind:
  c4_*: layered left-to-right; context elements that only send are placed left of the boundary and those that only receive right of it, so a child view lines up with its parent; in component views sibling containers sit between the container and system boundaries and root elements outside the system boundary; groups laid out as compound nodes
  erd_*: entities layered by reference direction; dependent entities beside their owner; attribute card height respected
  dfd_*: a topological sort of the forward flows from the start marker; nodes nobody feeds (a table only read) sit just before what they feed, sink external entities on the far right, tables written right of their writers, intermediate data between the processes it connects, expanded process groups as compound nodes laid out inside first, return flows as lanes below (requirement:dfd-flow-direction); transaction boundary regions recomputed from members
acceptance:
  - arrange a whole view or only selected nodes with one action; the result is one undoable layout operation
  - left-to-right is the default; C4 and ERD may also choose top-down, and their ports follow node positions (rule:edge-routing); DFD keeps left-to-right with side ports
  - choose spacing presets per run
  - boundaries, group boundaries, and external context follow rule:external-context-boundary after layout
  - arranging never changes model data, only data:diagram-view layout
  - new elements never land on top of existing ones
  - export uses the saved layout; auto-layout is not applied at export time
  - the AI tool surface exposes arrange_view so an agent can tidy a view it filled
manual_companion: requirement:layout-helpers covers align, distribute, and row or grid arrangement of a selection
non_goals:
  - continuous force-directed simulation
  - edge routing beyond orthogonal or straight lines with waypoints
depends_on:
  - data:diagram-view
  - requirement:drag-layout-editing
  - rule:external-context-boundary
  - rule:edge-routing
  - rule:group-membership
  - decision:shared-typescript-core
  - api:ai-tool-surface
```

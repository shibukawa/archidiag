---
id: requirement:edge-hover-highlight
type: requirement
title: Hover Highlight of Connections
---
Hovering a connector on any diagram must highlight it and its two endpoints, and hovering a node must highlight every connector touching it, so an author sees where a line goes without selecting anything.

```yaml
priority: v1
applies_to: C4 relationships, ERD relationships, DFD flows, and flows folded onto a collapsed group
hover_line:
  line: stroke switches to the selection color and widens; arrowheads and multiplicity or CRUD labels recolor with it
  endpoints: both nodes get the selection outline glow; a collapsed group counts as the endpoint
  label: the label box lifts above neighbouring lines
hover_node:
  lines: every connector touching the node highlights; the far endpoints glow more faintly
  others: unrelated lines dim slightly while the hover lasts
timing: immediate on pointer enter, cleared on pointer leave; no delay, no tooltip needed
selection: a selected line keeps its selection style; hover never changes fills, only strokes and outlines (rule:diagram-styles selection_and_hover)
exports: never rendered; hover is an editor state
acceptance:
  - hovering a line recolors it and outlines its two endpoints within one frame
  - hovering a node recolors all of its lines
  - keyboard focus on a line behaves like hover for accessibility
depends_on:
  - rule:diagram-styles
  - rule:edge-routing
  - ui:diagram-editor
```

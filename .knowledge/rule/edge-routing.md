---
id: rule:edge-routing
type: rule
title: Edge Routing by Diagram Family
---
DFDs attach connectors only to the left and right sides and read left to right; C4 and ERD views attach connectors on whichever side faces the other node and follow no reading direction.

```yaml
dfd_*:
  ports:
    allowed: left, right
    forbidden: top, bottom
    multiple: several connectors on one side spread evenly along it
  direction:
    default: the start marker on the far left, then nodes in flow order; a flow leaves the right side of its source and enters the left side of its target
    return_lane: a flow whose target is left of its source routes as a reverse S: out of the source's right side, across through the vertical gap between the two boxes, into the target's left side; only boxes on the same row force the crossing below both; drawn lighter (requirement:dfd-flow-direction)
    vertical_neighbors: nodes stacked vertically still connect through side ports with orthogonal bends
  layout: requirement:auto-layout lays DFDs out as a topological sort from the start marker; a source is never right of its target unless a loop exists; read tables sit just left of their readers
  check: layout.left_to_right_violations counts forward flows that point left, as info; zero after Arrange
  hover: requirement:edge-hover-highlight recolors a hovered line and outlines its endpoints
c4_and_erd:
  ports: nearest side of each node (left, right, top, or bottom), chosen by the relative position of the two nodes
  direction: none; authors place nodes freely and layout helpers respect that
  multiple: connectors sharing one side spread evenly along it
common:
  style: orthogonal with rounded corners; straight when aligned
  channels: parallel interior segments at the same coordinate are shifted apart so lines never overlap
  waypoints: user-editable; snapped to keep orthogonal entry and exit
  boundaries_and_groups: edges cross boundary borders freely; ports belong to nodes only
  exports: same routing as the canvas
```

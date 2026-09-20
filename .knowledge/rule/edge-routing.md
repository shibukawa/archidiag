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
    default: sources on the left, sinks on the right; a flow leaves the right side of its source and enters the left side of its target
    back_edge: a target left of its source routes out of the source's right side, around above or below, into the target's left side
    vertical_neighbors: nodes stacked vertically still connect through side ports with orthogonal bends
  layout: requirement:auto-layout lays DFDs out left-to-right; external sources left, sinks right, stores right of or below their processes
  check: layout.left_to_right_violations reports DFD views where most flows run right-to-left, as info
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

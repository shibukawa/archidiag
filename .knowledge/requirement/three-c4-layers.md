---
id: requirement:three-c4-layers
type: requirement
title: Support the Top Three C4 Layers
---
The editor must create and edit System Context, Container, and Component views over one hierarchical model and let users enter child scopes directly from the canvas.

```yaml
priority: mvp
acceptance:
  - create one diagram for each supported level
  - add, edit, move, and delete elements and relationships
  - double-click a software system in a System Context diagram to open its Container diagram
  - double-click a container in a Container diagram to open its Component diagram
  - drill up with breadcrumb or back navigation without losing layout or selection state
  - rename a canonical element once and see the new name in every diagram, inspector, navigator, and relationship label
  - keep diagram views linked by stable element ids rather than copied labels
  - keep Code diagrams visibly out of scope
depends_on:
  - term:c4-diagram-level
  - data:c4-project
  - rule:c4-model-integrity
  - rule:hierarchical-navigation
```

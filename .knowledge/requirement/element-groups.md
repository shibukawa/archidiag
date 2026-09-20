---
id: requirement:element-groups
type: requirement
title: Group Elements Inside a Scope
---
Authors must be able to group elements inside a scope into nestable, labeled boundaries that appear on the canvas and as hierarchy in the tree view, without changing model semantics.

```yaml
priority: v1
user_story: As an author, I group the Order Service, Order DB, and Order Worker containers as "Order Domain" so the container diagram and explorer show the microservice boundary.
acceptance:
  - create, rename, describe, color, and delete a group inside the current scope
  - add elements by drag into the group boundary or by choosing a group in the inspector
  - nest a group inside another group of the same scope
  - the explorer shows groups as collapsible nodes between the scope and its elements
  - the canvas draws a dashed labeled boundary that follows its members and auto-expands
  - relationships, validation, and navigation are unaffected by grouping
  - groups round-trip through project JSON and appear in PDF, draw.io, PNG, and SVG export
  - groups are available in c4_context (root), c4_container, c4_component, and erd_component
depends_on:
  - data:group
  - rule:group-membership
  - data:c4-project
  - requirement:drag-layout-editing
  - ui:diagram-editor
```

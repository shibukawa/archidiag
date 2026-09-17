---
id: flow:hierarchical-navigation
type: flow
title: Hierarchical Diagram Navigation
---
The author enters a child diagram by activating the canonical element that owns the child scope and returns through the ancestor path.

```yaml
flow:
  trigger: actor:diagram-author double-clicks an element in ui:diagram-editor
  steps:
    - id: resolve
      action: resolve the clicked canonical element id
    - id: enter_system
      condition: element kind is software_system
      action: open the Container diagram with scope_id equal to the element id
    - id: enter_container
      condition: element kind is container
      action: open the Component diagram with scope_id equal to the element id
    - id: render
      action: load child element_refs and diagram-specific layout
    - id: rename
      action: update the canonical name and re-render all affected views
    - id: exit
      action: use breadcrumb or back to restore the parent view
  failure:
    missing_child_view: offer to create the scoped diagram
    invalid_scope: show validation error and keep the current view
```

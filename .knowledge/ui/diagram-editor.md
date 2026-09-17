---
id: ui:diagram-editor
type: ui
title: Diagram Editor UI
---
The diagram editor combines a level-aware canvas, element inspector, validation feedback, project file actions, collaboration status, and AI change review.

```yaml
ui:
  root:
    kind: browser_app
    id: diagram-editor
    children:
      - kind: toolbar
        id: diagram-actions
        actions: new, open, save, export_json, export_pdf, export_drawio, export_png, export_svg, undo, redo, validate
      - kind: level_navigator
        id: c4-levels
        levels: context, container, component
        controls: breadcrumb, back, current_scope
      - kind: canvas
        id: diagram-canvas
        actions: select, create, connect, move_by_drag, delete, zoom, pan, double_click_enter
        navigation:
          software_system: open child container scope
          container: open child component scope
          other_element: select and inspect
      - kind: boundary
        id: current-system-boundary
        state: visible in container and component views
        placement: around current scope; external context remains outside
        actions: resize_from_bottom_right
      - kind: diagram_title_block
        id: diagram-title
        placement: fixed bottom left inside the web canvas
        format: "<diagram level> View: <scope name>"
        generated_output: below the lowest element and aligned with the leftmost element
      - kind: inspector
        id: element-inspector
        fields: name, description, technology, tags, container_category, data_store_kind
      - kind: container_type_controls
        id: container-taxonomy
        visible_when: current_element.kind == container
        controls: application | data_store, database | database_schema | pubsub | other
      - kind: validation_panel
        id: validation-results
      - kind: collaboration_panel
        id: session-status
        state: hidden when no session
      - kind: ai_review_panel
        id: ai-change-review
        state: hidden when no proposal
```

---
id: requirement:canvas-quick-create
type: requirement
title: Canvas Quick Create
---
Authors must be able to open a creation popover on any canvas, set default attributes once, then type a name and press Enter repeatedly to create one element per line while focus stays in the name field.

```yaml
priority: v1
user_story: As an author, I open quick create in a Container view, set "data store, database, postgresql", then type Orders DB, Enter, Catalog DB, Enter, and both cylinders appear side by side.
popover:
  open: toolbar button, keyboard shortcut, double-click on empty canvas, or context menu on empty canvas
  defaults_section: kind-specific attributes that apply to every element created while the popover stays open; enumerations render as radio buttons, never select boxes, so all options are visible in one tap
  name_field: focused on open and after each creation; Enter creates; Escape closes; Shift+Enter inserts a line break in a description field when shown
  ime: composition Enter confirms composition only; creation happens on a non-composing Enter
defaults_by_kind:
  c4_context: person | software_system | external_system
  c4_container: application | data_store with data_store_kind and sql_dialect; group
  c4_component: component; group
  erd_component: independent entity with classification; erd_code: dependent entity of the current owner
  dfd_*: process | external_entity | data_store (pick element) | intermediate file | intermediate queue; new process elements are also created in the C4 scope
placement:
  - each new element is placed right of the previous one created in this session, wrapping to a new row, never overlapping (requirement:auto-layout initial placement)
  - the last created element stays selected so a link handle drag can follow immediately
result:
  - every creation is one undoable operation; the popover session is not one batch
  - names are bound to vocabulary on creation (rule:vocabulary-resolution) for entities
  - DFD nodes that need a canonical element create it in the current scope with the chosen kind and place a node for it
acceptance:
  - ten containers can be created with ten lines of typing and no mouse use
  - changing a default mid-session affects only later creations
  - the popover remembers its last defaults per diagram kind within the browser session
  - an empty or whitespace-only name is ignored without closing the popover
depends_on:
  - data:c4-project
  - data:entity
  - data:dfd-model
  - requirement:auto-layout
  - requirement:vocabulary-dictionary
  - ui:diagram-editor
```

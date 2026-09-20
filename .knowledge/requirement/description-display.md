---
id: requirement:description-display
type: requirement
title: Descriptions on Every Diagram Item
---
Entities, entity relationships, DFD nodes, and flows must carry a text description and technology like C4 elements, and every view must be able to switch between compact labels and descriptive rendering.

```yaml
priority: v1
fields:
  entity: description, technology (data:entity)
  entity_relationship: description (data:entity-relationship)
  dfd_node: description, technology in addition to label_override (data:dfd-model)
  dfd_flow: description, technology in addition to label (data:dfd-model)
  c4: description and technology already exist
display_modes (per view, remembered; default descriptive):
  compact: name only; descriptions on hover
  descriptive: name, kind tag, technology in brackets, description text inside the node, like the C4 reference style
  technology_only: name plus technology
rendering:
  - descriptive mode grows nodes to fit a bounded number of lines and truncates with an ellipsis; full text on hover and in the inspector
  - relationship and flow descriptions render under the label in descriptive mode
  - export honors the view's mode; the document bundle always includes full descriptions in tables
  - DFD nodes backed by a canonical element show that element's description unless overridden
acceptance:
  - edit description and technology for entities, entity relationships, DFD nodes, and flows in the inspector
  - toggle the view mode from a segmented control in the canvas toolbar beside zoom, never from the inspector; layout adapts without losing positions
  - new views open in descriptive mode
  - descriptions participate in search, catalogs, and analysis
  - check items c4.element_has_description extend to entities, DFD nodes, and flows
depends_on:
  - data:entity
  - data:entity-relationship
  - data:dfd-model
  - data:diagram-view
  - rule:diagram-styles
  - requirement:configurable-model-checks
  - ui:diagram-editor
```

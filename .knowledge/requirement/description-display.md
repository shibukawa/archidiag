---
id: requirement:description-display
type: requirement
title: Descriptions on Every Diagram Item
---
Entities, entity relationships, DFD nodes, and flows must carry a text description like C4 elements, with a technology slot filled by the storage kind for entities, and every view must be able to switch between compact labels and descriptive rendering.

```yaml
priority: v1
fields:
  entity: description; the technology slot shows the storage kind (decision:storage-kind-as-technology)
  entity_relationship: description (data:entity-relationship)
  dfd_node: description, technology in addition to label_override (data:dfd-model)
  dfd_flow: description, technology in addition to label (data:dfd-model)
  c4: description and technology already exist
display_modes (per view, remembered; default descriptive):
  compact: name only; descriptions on hover
  descriptive: name, kind tag, technology in brackets, description text inside the node, like the C4 reference style
  technology_only: name plus technology; c4_* views only
  fields: erd_* views only; name, kind tag, and the important attribute rows (requirement:erd-field-visibility)
rendering:
  - descriptive mode grows nodes to fit a bounded number of lines and truncates with an ellipsis; full text on hover and in the inspector
  - description text is left-aligned inside the node on every diagram kind; centred paragraphs leave a ragged right edge that is hard to read; name and kind tag stay centred
  - relationship and flow descriptions render under the label in descriptive mode
  - export honors the view's mode; the document bundle always includes full descriptions in tables
  - DFD nodes backed by a canonical element show that element's description unless overridden
  - the segmented control offers descriptive | compact | technology on c4_* views and descriptive | fields | compact on erd_* views
  - entity card height follows the mode: fixed in descriptive and compact, per shown row count in fields
acceptance:
  - edit description for entities and description and technology for entity relationships, DFD nodes, and flows in the inspector
  - toggle the view mode from a segmented control in the canvas toolbar beside zoom, never from the inspector; layout adapts without losing positions
  - new views open in descriptive mode, erd views included, so a table reads like a C4 element until fields mode is chosen
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

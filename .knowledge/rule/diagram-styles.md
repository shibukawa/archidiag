---
id: rule:diagram-styles
type: rule
title: Diagram Style Themes
---
Shapes and colors are not fixed by C4; what matters is that every kind is drawn consistently within a project and explained by the legend, so styles come from a project-selected theme of tokens rather than from canonical C4 pictures.

```yaml
principle: consistent per kind, explained by data:diagram-legend; any theme that satisfies both is valid C4
theme:
  scope: one active data:style-theme per project; views cannot override it
  tokens: one per kind and role (fill, stroke, dash, text color, shape, corner icon)
  shapes_available: rounded_box, box, cylinder, horizontal_cylinder, card, pentagon, open_rect, folded_rect, home_plate, region
  icon_badges: small corner icons replace large pictograms; person, external, data store, queue, file, agent
built_in_themes:
  compact (default):
    person: rounded_box, dark blue, small person icon at top-left; same footprint as a system box
    software_system: rounded_box, blue
    container_application: rounded_box, mid blue; application kind adds the picture: browser window chrome, mobile device frame, desktop window, a large ">_" prompt for servers, a gear for workers
    container_data_store_database_and_schema: cylinder, mid blue; schema adds a tag
    container_data_store_pubsub_and_queue: horizontal_cylinder, mid blue; queue icon
    container_data_store_bucket: bucket shape (elliptical rim, tapered body)
    container_data_store_file_share: folder shape
    container_data_store_cache: rounded_box with a bolt icon
    container_data_store_other: rounded_box, mid blue, data store icon
    component: rounded_box, light blue, dark text
    entity: card with light blue header; dependent entity dashed header underline
    external_context: same shape as its kind, gray fill, external icon
    boundaries: scope solid dark gray line, named at its bottom-left with a kind tag; group dashed gray with a top-left label and optional tint
  classic_c4:
    person: pictogram head over a box (the familiar C4 figure); cylinders for data stores; everything else as compact
  monochrome:
    fills by lightness only, for print and colorblind-safe output
relationships (routing: rule:edge-routing):
  c4: solid line with arrowhead and label; technology in smaller text
  projected: hollow arrowhead when an endpoint was promoted to an ancestor
  entity: UML multiplicity labels at both ends; reference open arrowhead, dependent filled diamond at the owner, inherit hollow triangle at the parent, label dashed
dfd:
  external_entity, process, data_store, intermediate_file, intermediate_queue, diagram_ref, flow, transaction_boundary: theme tokens; the compact theme uses cylinder for database-backed stores and entity stores, open_rect only for stores of kind other, folded_rect for files, horizontal_cylinder for queues, home_plate for references, a numbered rounded_box with side bars for processes
overrides:
  perspective_styles: an activated perspective's per-value styles replace fill or stroke but never the shape
  lifecycle: planned dashed outline; deprecated gray fill with strike badge
  classification: badge only
  selection_and_hover: outline glow only; never a fill change
customization:
  - a project may copy a built-in theme and edit tokens; the legend renders from the edited tokens
  - per-element arbitrary colors are not allowed; tint is allowed only on groups
  - a theme travels with the project file and the document bundle
themes_and_modes:
  editor: light and dark variants of each theme; dark remaps fills to keep contrast, shapes unchanged
  export: light variant
constraints:
  - every token keeps a contrast ratio of at least 4.5:1 between fill and text
  - two kinds never share an identical token set within one theme
  - legend swatches render from the same tokens (data:diagram-legend)
```

---
id: rule:diagram-frame
type: rule
title: Diagram Frame with Title Block and Legend
---
Every diagram, on screen and in every image export, carries a title block at the bottom-left naming the diagram kind and scope, and a legend at the bottom-right explaining every notation actually used in the view.

```yaml
title_block:
  position: bottom_left
  lines:
    - "<kind label>: <scope name>" plus " (<view name>)" for a non-default view; dfd_* adds " / <use case>"
    - project name, name mode, and export date on export only
  kind_labels:
    c4_context: System Context View
    c4_container: Container View
    c4_component: Component View
    erd_component: Component ERD
    erd_code: Code ERD
    dfd_context: System Context DFD
    dfd_container: Container DFD
    dfd_component: Component DFD
legend:
  position: bottom_right
  content: data:diagram-legend derived from the view; only notations present in the view appear
  minimum: element kinds, relationship line styles, boundary and group styles; because shapes are theme-defined, the legend is what makes the diagram readable as C4
  additions_when_present: DFD node kinds and CRUD letters, intermediate data kinds, diagram references, transaction boundary consistency, active perspective styles and values, lifecycle styles, classification badges, external context marker
editor:
  - both blocks are fixed overlays in the canvas corners, unaffected by pan and zoom
  - they collapse to one line each when the canvas is small and expand on hover
  - they cannot be hidden, moved, or deleted; the legend can be temporarily minimized
export:
  - png, svg, pdf, and draw.io always include both blocks
  - placement: title block below the lowest element aligned with the leftmost element; legend at the same baseline aligned with the rightmost element; the canvas grows to fit
  - draw.io emits them as locked groups
  - the document bundle repeats them under every embedded view
styles: rule:diagram-styles
constraints:
  - the legend never lists a notation absent from the view
  - text uses the active name mode and UI locale
```

---
id: requirement:diagram-export-formats
type: requirement
title: Export Diagrams to Common Formats
---
Authors must be able to export the current diagram as JSON, PDF, draw.io XML, PNG, or SVG.

```yaml
priority: v1
formats:
  - json: portable project data
  - pdf: printable diagram with boundary and title block
  - drawio: editable diagrams.net-compatible XML
  - png: raster image of the current diagram
  - svg: vector image of the current diagram
acceptance:
  - export uses the current scope and current names
  - exports include relationships, boundary, external context, and a title below the lowest element aligned with the leftmost element
  - title format is "<diagram level> View: <scope name>"
  - draw.io output remains editable as nodes and edges
  - export failures show an actionable message
depends_on:
  - data:c4-project
  - ui:diagram-editor
```

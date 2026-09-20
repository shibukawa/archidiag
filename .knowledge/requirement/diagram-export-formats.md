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
  - pdf: printable diagram with boundary, title block, and legend
  - drawio: editable diagrams.net-compatible XML
  - png: raster image of the current diagram
  - svg: vector image of the current diagram
  - ddl: SQL for the current data store in its dialect (requirement:sql-ddl-export)
acceptance:
  - export uses the current scope and current names
  - exports include relationships, boundary, external context, the title block, and the legend placed per rule:diagram-frame
  - colors and shapes follow rule:diagram-styles in the light theme regardless of the editor theme
  - title format by kind: "<level> View: <scope>" for c4_*, "<level> ERD: <scope>" for erd_*, "<level> DFD: <use case> / <scope>" for dfd_*; a non-default view appends " (<view name>)"
  - group boundaries and perspective badges are included in every rendered export; an optional appendix lists perspective notes
  - erd_* export shows attribute rows and UML multiplicity ends in the active name mode; dfd_* export shows process numbers, intermediate data, and diagram references
  - draw.io output remains editable as nodes and edges
  - export failures show an actionable message
depends_on:
  - rule:diagram-frame
  - rule:diagram-styles
  - data:c4-project
  - ui:diagram-editor
```

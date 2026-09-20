---
id: data:diagram-legend
type: data
title: Diagram Legend
---
A diagram legend is a derived list of legend entries computed from what a view contains, each pairing a swatch with a label, so the legend always matches the diagram.

```yaml
fields: entries
entry: swatch (shape, fill, stroke, dash, badge), label, group
groups (ordered):
  elements: person, software system, external system, application container per application kind, data store kinds, component, entity, dependent entity
  relationships: C4 relationship, view-projected relationship, entity relationship kinds with UML multiplicity and end markers, DFD flow with CRUD letters
  boundaries: scope boundary, group boundary, transaction boundary atomic and eventual
  dfd_nodes: external entity, process, data store, intermediate data file and queue, diagram reference
  perspectives: active perspective values with their styles; badges for perspectives with notes in the view
  markers: lifecycle values present, classification levels present, external context, dependent count badge
derivation: pure over the data:diagram-view and its rendered elements; recomputed on change
constraints:
  - an entry appears only when at least one rendered item uses it
  - entries use the same style tokens as the canvas from the active data:style-theme (rule:diagram-styles)
  - labels follow the UI locale
```

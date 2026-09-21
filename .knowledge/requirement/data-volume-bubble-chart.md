---
id: requirement:data-volume-bubble-chart
type: requirement
title: Data Volume Bubble Chart
---
Authors must be able to open a bubble chart for a data store, or for the whole project, where each entity is a bubble whose area is its estimated data size at the horizon, so the largest tables and the fastest-growing ones stand out before a schema is built.

```yaml
priority: v1
user_story: As an author reviewing the Orders DB, I open the bubble chart and see Order Line dwarfing Customer; hovering Order Line shows 15,000 rows per day at 120 bytes.
open_from: the canvas toolbar of an erd_* view for that data store; the data store container's inspector; the project explorer for all stores
bubbles:
  area: bytes_at_horizon from data:entity-volume; entities without an estimate appear as small dashed outlines so nothing is silently missing
  color: entity classification (resource, event, summary, work, code) with a legend
  label: entity name and the size in a human unit; the daily write rows on hover with every assumption
  layout: packed circles, largest first, deterministic for the same input so exports are stable
  groups: one panel per data store; the project view places one cluster per store with the store name and total
controls:
  horizon: the shared project horizon; changing it re-sizes every bubble
  measure: bytes (default) | rows | daily write rows
  click: selects the entity and shows it in the inspector; double-click opens its ERD
export: PNG and SVG with a title block "Data volume: <store> at <horizon>"; the document bundle embeds it per store (requirement:document-bundle-export)
depends_on:
  - data:entity-volume
  - requirement:data-volume-estimation
  - data:entity
  - rule:diagram-frame
  - ui:diagram-editor
```

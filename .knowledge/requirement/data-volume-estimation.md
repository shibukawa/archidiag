---
id: requirement:data-volume-estimation
type: requirement
title: Data Volume Estimation per Entity
---
Authors must be able to record record length, initial rows, growth, refresh cycle, and retention on each entity, and see the derived row count and data size at a chosen horizon in the inspector, catalogs, and exports.

```yaml
priority: v1
user_story: As an author, I set Order to 200 bytes per row, 5,000 new rows per day, kept forever, and the inspector shows about 5.5M rows and 1.1 GB after 36 months; the table catalog sorts the store's tables by that size.
capture:
  inspector: a Volume section on the entity with the data:entity-volume fields, below the field list
  quick_defaults: growth_period day, refresh_mode append, refresh_every daily
  ai: set_entity_volume on api:ai-tool-surface
derive:
  - the estimate follows data:entity-volume derived rules and shows rows, bytes, and daily write rows with a human unit (KB, MB, GB, TB)
  - the horizon is one project setting, editable from the volume section and the bubble chart
  - a data store total sums the estimates of its entities and appears in the container's inspector
report:
  - the table catalog and the document bundle list the assumptions and the estimate per entity (requirement:project-catalogs, requirement:document-bundle-export)
  - element analysis shows the estimate in its header (requirement:element-analysis-view)
checks (data:check-item):
  - erd.entity_has_volume: an entity without record_bytes, info by default
  - erd.rebuild_without_initial_rows: rebuild mode without initial_rows, info by default
non_goals:
  - index size, compression, and free space; the estimate says it excludes them
  - deriving record_bytes from column types before domains exist (requirement:domain-dictionary)
depends_on:
  - data:entity-volume
  - data:entity
  - decision:storage-kind-as-technology
  - requirement:data-volume-bubble-chart
  - requirement:configurable-model-checks
  - ui:diagram-editor
```

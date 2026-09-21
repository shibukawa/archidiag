---
id: decision:storage-kind-as-technology
type: decision
title: Storage Kind Fills the Entity Technology Slot
---
An entity card shows its storage kind in C4 technology brackets before its classification, "[Table] Event", and has no free-text technology field; physical facts that were tempting to write there belong to data:entity-volume.

```yaml
status: accepted 2026-09-21
supersedes: entity technology as a free physical note (partitioning, engine, refresh schedule)
chosen:
  kind_tag: "[Table] Event"; the storage kind renders first as [Table] | [View] | [Materialized view], then the classification; the word Entity is dropped because every card on an ERD is one
  dbms: the data store container keeps the DBMS name as its technology
  physical_facts: record length, growth, refresh, and retention are structured fields of data:entity-volume, never prose
why:
  - a reader of a C4 container sees "[PostgreSQL]"; a reader of a table should see "[Table]" or "[View]" in the same place, so the diagram grammar stays one
  - free text cannot feed the size estimate or the bubble chart (requirement:data-volume-estimation, requirement:data-volume-bubble-chart)
  - partitioning is a consequence of volume and access, so it is derived or noted next to the estimate rather than typed as the table's technology
rejected:
  technology_free_text: unqueryable and duplicated the storage kind
  storage_kind_as_kind_tag: "Table · Event" hid that the entity is still an entity and broke the C4 bracket convention
consequences:
  - data:entity drops technology; import ignores a stored value
  - compact display mode drops the bracket like a C4 element does (requirement:description-display)
  - the inspector shows storage kind as a radio and volume as its own section (ui:diagram-editor)
```

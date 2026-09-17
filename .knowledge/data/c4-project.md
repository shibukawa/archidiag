---
id: data:c4-project
type: data
title: C4 Project Model
---
The C4 project model is a portable document with one canonical hierarchy that is rendered through context, container, and component diagram views.

```yaml
required:
  project_id: stable id
  schema_version: explicit version
  model_tree:
    roots: people, software systems, external systems
    children: software system -> containers -> components
  diagrams:
    - id
      level: context | container | component
      scope_id: owning canonical element id or project root
      element_refs: canonical element ids
      relationships
elements:
  fields: id, kind, parent_id, name, description, technology, tags, container_category, data_store_kind
  identity: one canonical record is referenced by every diagram view
  container_taxonomy:
    categories: application | data_store
    data_store_kinds: database | database_schema | pubsub | other
    rule: data_store_kind is required when container_category is data_store
relationships:
  fields: id, source_id, target_id, description, technology, direction
  view_projection: optional per-level endpoint mapping for nested diagrams
layout:
  fields: diagram_id, element_id, position, size, style, boundary
rename_behavior: update the canonical element name; all references and views resolve the new name
portable_formats:
  - JSON project file
  - rendered diagram export: pdf, drawio, png, svg
```

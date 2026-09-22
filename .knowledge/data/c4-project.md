---
id: data:c4-project
type: data
title: C4 Project Model
---
The C4 project model is a portable document with one canonical hierarchy, a project vocabulary, a domain dictionary, and diagram views of every kind in term:diagram-family.

```yaml
required:
  project_id: stable id
  schema_version: integer version of the data format (decision:project-schema-versioning)
  model_tree:
    roots: people, software systems, external systems
    children: software system -> containers -> components
    data_store_children: database or database_schema container -> independent entities -> dependent entities (data:entity); pubsub or queue container -> topics; bucket or file_share container -> folders (data:store-item)
  vocabulary: data:vocabulary-entry records (requirement:vocabulary-dictionary)
  naming_policy: rule:physical-naming-policy selection and suggestion provider setting
  languages: business_language, system_language (requirement:ui-localization)
  style_theme: data:style-theme selection or customized copy
  volume_horizon_months: horizon for data:entity-volume estimates, default 36
  domains: data:data-domain records (requirement:domain-dictionary)
  groups: data:group records (requirement:element-groups)
  perspectives: data:perspective and data:perspective-note records (requirement:perspectives)
  checks: data:check-profile ladder, custom data:check-item instances, active_profile_id (requirement:configurable-model-checks)
  diagrams: data:diagram-view records; many per scope and kind, one default each
    - id
      kind: c4_context | c4_container | c4_component | erd_component | erd_code | dfd_container
      scope_id: owning canonical element id or project root
      name, is_default
      element_refs: subset of the scope's elements; empty means all
      use_case: dfd_* kinds only
      dfd_payload: nodes and flows per data:dfd-model when kind is dfd_*
elements:
  fields: id, kind, parent_id, group_id, name, name_binding, description, technology, container_category, data_store_kind, sql_dialect, classification, attributes
  no_tags: free-form tags are not a field; use data:group for structure and data:perspective for cross-cutting labels
  kinds: person | software_system | external_system | container | component | entity | topic | folder
  identity: one canonical record is referenced by every diagram view
  container_taxonomy:
    categories: application | data_store
    application_kinds: web_browser | mobile_app | desktop_app | server | worker | other
    data_store_kinds: database | database_schema | pubsub | queue | bucket | cache | file_share | other
    rule: data_store_kind is required when container_category is data_store
    sql_dialect: postgresql | sqlite | mysql for database and database_schema containers; drives requirement:sql-ddl-export
    placeholder: true on the system's "Unknown container", created on demand for components placed from a DFD before their container is known (decision:dfd-drives-c4)
  component_fields:
    passthrough: true for components that only route, validate, or adapt (controllers, gateways, adapters); in a DFD they bind to the API document they handle instead of being a process (decision:dfd-passthrough-components)
relationships:
  fields: id, source_id, target_id, description, technology, direction
  view_projection: optional per-level endpoint mapping for nested diagrams
  derived: relationships derived from DFD flows are computed, not stored, and draw on the same line as stored ones between the same pair (decision:dfd-drives-c4)
entity_relationships: data:entity-relationship records scoped to one data store
layout:
  fields: diagram_id, element_id, position, size, style, boundary, collapsed
rename_behavior: update the canonical element or vocabulary entry once; every C4, ERD, and DFD view resolves the new name
migration: files without kind default each diagram to its c4 level kind (a data store scope becomes erd_component) and start with empty vocabulary, domain, entity, DFD, group, and perspective sets
portable_formats:
  - JSON project file; YAML folder on disk (decision:yaml-on-disk-json-in-browser)
  - rendered diagram export: pdf, drawio, png, svg
  - DDL per data store dialect (requirement:sql-ddl-export)
```

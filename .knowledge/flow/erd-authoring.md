---
id: flow:erd-authoring
type: flow
title: ERD Authoring Flow
---
The author zooms into a data store, models independent tables with vocabulary and domains, zooms into a table to add dependent tables, and returns with the model still linked.

```yaml
flow:
  trigger: actor:diagram-author double-clicks a database or database_schema container in ui:diagram-editor
  steps:
    - id: enter_component
      action: open the erd_component diagram of the data store (term:erd-notation)
    - id: add_entity
      action: create an independent data:entity; name is bound by rule:vocabulary-resolution
    - id: edit_attributes
      action: open the field list and type names with Enter; each field gets a same-named domain (flow:domain-lifecycle); drop a dictionary domain only when one is already known
    - id: relate
      action: drag the link handle between entities, choose kind and cardinality (data:entity-relationship)
    - id: enter_code
      condition: a table needs dependent tables
      action: double-click the entity to open erd_code, add dependent entities with dependent relationships
    - id: consolidate
      condition: several tables are sketched
      action: open the dictionary, merge duplicate domains, then type and name the survivors
    - id: validate
      action: run rule:erd-scope-integrity; uncurated or unresolved domains and missing physical names appear at the active profile's levels
    - id: exit
      action: breadcrumb back; the owner card shows a dependent count and the data store shows an entity count
  failure:
    not_a_database_store: explain that only database and database_schema containers own entities
    cross_store_relationship: reject and suggest a DFD flow or a C4 relationship instead
```

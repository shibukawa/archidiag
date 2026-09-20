---
id: rule:erd-scope-integrity
type: rule
title: ERD Scope Integrity
---
Entities live only under database or database_schema containers or under an owner entity of the same data store, and every attribute, domain, and relationship reference resolves within that data store.

```yaml
scope:
  allowed_root: container with container_category data_store and data_store_kind database | database_schema
  forbidden_root: application container, pubsub, other, person, external system
entities:
  - dependency independent means parent_id is the data store container
  - dependency dependent means parent_id is an entity of the same data store and exactly one dependent data:entity-relationship names it
  - entity names are unique within one data store
  - a dependency chain never cycles
attributes:
  - attribute names are unique within an entity
  - domain_id resolves to a project data:data-domain
  - at most one ordered primary key group per entity
entity_relationships:
  - both endpoints are entities of the same data store
  - cardinality is set on both ends except for label kind
  - a dependent relationship has exactly one owner per dependent entity
deletion:
  - deleting a data store container or an owner entity lists dependent entities and DFD references before confirmation
export_readiness:
  - unresolved domains, missing physical names, and column name conflicts are data:check-item findings whose level comes from the active profile (rule:check-evaluation)
navigation: rule:hierarchical-navigation
validation: rule:c4-model-integrity
```

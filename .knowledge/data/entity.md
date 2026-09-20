---
id: data:entity
type: data
title: Entity
---
An entity is a table-like canonical element inside a data store container; an independent entity is a component of the data store and a dependent entity is a code-level child of another entity.

```yaml
fields: id, kind=entity, parent_id, dependency, name, name_binding, description, classification, technology, attributes, lifecycle_note
dependency: independent | dependent; explicit, editable in the inspector, and kept consistent with parent_id
parent_id:
  independent: data store container id with data_store_kind database or database_schema
  dependent: owning entity id
level:
  independent: shown in the data store's erd_component diagram
  dependent: shown in the owner's erd_code diagram; the owner card shows a dependent count badge
dependency_meaning: the dependent entity exists only inside its owner (ownership, lifecycle, delete cascade); SQL foreign keys alone cannot preserve this, so the tree keeps it explicit
classification: master | transaction | detail | summary | history | snapshot | work | reference | log
name_binding: data:vocabulary-binding
attributes: ordered data:attribute list
technology: optional physical table note, for example partitioning or engine
examples:
  independent: User
  dependent_of_user: Affiliation, Belonging
constraints:
  - entity ids are unique across the project and referenced by DFD nodes and flow data_refs
  - changing dependency or parent_id moves the entity between levels without a new id; setting dependent asks for the owner, setting independent reparents to the data store
  - erd_component shows independent entities only; dependent entities appear in the owner's erd_code and as a count badge
  - relationships are data:entity-relationship records, never attributes
```

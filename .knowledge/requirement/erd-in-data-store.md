---
id: requirement:erd-in-data-store
type: requirement
title: ERD as Data Store Component and Code Views
---
Authors must be able to zoom into a database or database schema container to model its independent tables as components, and zoom into a table to model its dependent tables at code level, using project vocabulary and domains.

```yaml
priority: v1
user_story: As an author, I double-click the Orders schema, see User and Order tables with UML-style multiplicity, then double-click User and see Affiliation and Belonging as its dependent tables.
acceptance:
  - double-clicking a database or database_schema container opens its erd_component diagram
  - double-clicking an entity opens its erd_code diagram showing the entity and its dependent entities
  - breadcrumb shows root > system > data store > entity > dependent entity
  - create, rename, classify, and delete entities; a dependent entity is created from its owner with a dependent relationship
  - the owner card shows a dependent count badge in erd_component
  - add fields by typing a name and Enter; each new field gets a same-named domain (requirement:domain-consolidation)
  - edit attributes in a field list: name, domain, required, unique, primary key, key kind (surrogate or natural), default, value generation, description, important, order
  - entity cards carry a description like C4 elements and show the storage kind in the technology brackets (decision:storage-kind-as-technology); fields mode shows only important attributes (requirement:erd-field-visibility)
  - a new entity gets a surrogate primary key <entity>_id by default; a natural key <entity>_code can be added as unique
  - override automatic domains from the dictionary panel when needed and bind names through vocabulary
  - draw reference, dependent, inherit, and label relationships with UML multiplicity on both ends and a reading direction
  - a reference marked important shows a chain-icon reference row on the source card instead of a foreign key attribute
  - relationships to hidden dependent entities project onto the owner in erd_component
  - the SQL dialect of the data store, physical names, and volume assumptions (requirement:data-volume-estimation) can be entered at any time; physical names show in physical name mode
  - validation reports rule:erd-scope-integrity issues and export readiness warnings
  - export erd_component and erd_code as JSON, PDF, draw.io, PNG, and SVG with title "Component ERD: <data store>" or "Code ERD: <entity>"
non_goals:
  - reverse engineering from a live database
slices:
  1_component_erd: erd_component under database and database_schema containers; independent entities with description, classification, storage kind, volume assumptions; attributes with important, primary key, required, unique, description; reference relationships with multiplicity; descriptive and fields display modes; JSON, SVG, PNG, PDF, draw.io export
  2_code_erd: dependent entities, erd_code, dependent and inherit relationships, count badges, projection to owners
  3_dictionaries: domains, vocabulary binding, physical names, DDL (requirement:domain-dictionary, requirement:vocabulary-dictionary, requirement:sql-ddl-export)
ddl: requirement:sql-ddl-export
depends_on:
  - term:erd-notation
  - term:c4-diagram-level
  - data:entity
  - data:attribute
  - data:entity-relationship
  - data:erd-model
  - rule:erd-scope-integrity
  - rule:hierarchical-navigation
  - requirement:vocabulary-dictionary
  - requirement:domain-dictionary
  - requirement:erd-field-visibility
  - requirement:description-display
  - requirement:container-types
  - decision:no-logical-physical-split
  - ui:diagram-editor
```

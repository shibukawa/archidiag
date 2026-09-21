---
id: data:entity-relationship
type: data
title: Entity Relationship
---
An entity relationship is a named association between two entities of one data store with a kind that decides physical projection and level placement.

```yaml
fields: id, kind, name, source_entity_id, target_entity_id, target_key, source_cardinality, target_cardinality, reading_direction, description, on_delete, important
important: references only, default false; when true the source card draws a reference row (requirement:erd-field-visibility)
target_key: primary (default) | natural
kinds:
  reference: foreign key from the many side to the one side; targets the primary key, normally the surrogate <entity>_id, or a natural <entity>_code when target_key is natural
  dependent: owner to dependent entity; implies target parent_id equals source; cascade delete
  inherit: child to parent; parent attributes are copied into the child on physical projection
  label: documentation link with no physical effect
cardinality: "1 | 0..1 | * | 1..*" rendered as UML multiplicity labels (term:erd-notation)
reading_direction: source_to_target | target_to_source; chosen by meaning, not by cardinality
key_holder: the source of a reference always holds the key (decision:reference-source-holds-key)
reference_projection:
  many_side_row: a chain-icon row on the source card showing the referenced entity and the relationship name; drawn only when the relationship is important
  composite_key: follows rule:domain-expansion of the referenced primary key
level_placement:
  component: relationships between independent entities; relationships to a dependent entity project to its owner (rule:nested-relationship-projection)
  code: relationships among the owner and its dependent entities
constraints:
  - both entities belong to the same data store scope (rule:erd-scope-integrity)
  - dependent kind is the only way to create or move a dependent entity under an owner
  - many_to_many reference projects to a join table named after the relationship
```

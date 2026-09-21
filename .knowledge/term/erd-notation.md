---
id: term:erd-notation
type: term
title: ERD Notation
---
ERD notation renders entities as attribute cards connected by UML-style relationships with multiplicity labels at both ends in erd_component and erd_code diagrams.

```yaml
notation: uml_multiplicity
entity_card:
  header: entity name in the selected name mode (requirement:name-display-switching); kind tag reads "[<storage kind>] <classification>", for example "[Table] Event"; the word entity is omitted because every card is one; compact mode drops the brackets (decision:storage-kind-as-technology)
  rows:
    fields_mode: important data:attribute rows with a key marker plus projected relationship references; a footer row counts hidden attributes (requirement:erd-field-visibility)
    descriptive_mode: description text like a C4 element (requirement:description-display)
    compact_mode: header only
  badges: dependent entity count; the kind tag carries the storage kind in brackets before the classification, for example "[Table] Event"
relationship:
  kinds: data:entity-relationship
  multiplicity_ends: "1 | 0..1 | * | 1..*" as text labels near each end
  reference: plain line with an open arrowhead toward the referenced entity
  dependent: filled diamond at the owner end (UML composition)
  inherit: hollow triangle at the parent end (UML generalization)
  label: dashed line, no ends
  name: relationship name at the middle, reading arrow when a direction is set
kinds:
  erd_component: independent entities of one data store; dependent entities collapsed into a count badge
  erd_code: one entity expanded with its dependent entities and their internal relationships
  cross_level_projection: rule:nested-relationship-projection
scope_owner: container with data_store_kind database or database_schema
styles: rule:diagram-styles; frame: rule:diagram-frame; routing: rule:edge-routing
```

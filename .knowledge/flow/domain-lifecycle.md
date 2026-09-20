---
id: flow:domain-lifecycle
type: flow
title: Domain Lifecycle from Field to DDL
---
A domain starts as an automatic twin of a field name, is consolidated with its duplicates, gets a canonical type and names, and finally substitutes its type into DDL columns.

```yaml
flow:
  trigger: actor:diagram-author types a field name and presses Enter in the field list (requirement:canvas-quick-create style entry)
  steps:
    - id: birth
      action: create data:attribute X and assign the domain named X; create it as unresolved with origin from_field when absent (requirement:domain-consolidation)
    - id: reuse
      condition: a domain named X already exists
      action: assign the existing domain; no duplicate is created
    - id: override
      condition: the author knows the domain
      action: drop or pick a dictionary domain onto the field instead of the automatic one
    - id: consolidate
      action: in the dictionary or the domain catalog, merge duplicate candidates into one survivor; attributes follow, merged names become vocabulary aliases
    - id: curate
      action: mark the survivor curated by giving it a category, description, and a canonical type or components (data:primitive-type, data:domain-component)
    - id: name
      action: complete system and physical names through vocabulary and requirement:name-suggestion
    - id: classify
      condition: the domain carries sensitive data
      action: set a data_classification note on the domain; it propagates per rule:classification-propagation
    - id: project
      action: DDL substitutes the domain's canonical type inline per data:sql-dialect-mapping (requirement:sql-ddl-export)
  checks_along_the_way: domain.duplicate_candidates, domain.single_use, domain.uncurated, domain.has_type, vocabulary.has_physical_name
  failure:
    merge_conflict: merged domains disagree on type, classification, or components; the survivor's values win and a warning lists what was dropped
    unresolved_at_export: export readiness finding names the columns whose domain has no type
```

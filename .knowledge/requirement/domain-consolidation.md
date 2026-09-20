---
id: requirement:domain-consolidation
type: requirement
title: Field Name as Domain, Consolidated Later
---
Creating a field must create or reuse a domain with the same name, so every column has a domain from the first keystroke, and the domain dictionary must offer merge tools to consolidate those domains as the model matures.

```yaml
priority: v1
user_story: As an author, I type created_at in three tables; each gets a created_at domain; later I merge them into one CreatedAt domain typed as timestamptz and all three columns follow.
creation:
  rule: quick entry of a field named X assigns the domain named X, creating it as unresolved when absent
  matching: by name in the active name mode, case-insensitive within the project
  override: dropping a domain onto the entry or picking one in the row uses that domain instead
  attribute_name: stays X; use_domain_name is false so renaming the domain later does not rename the column unless the author opts in
consolidation:
  merge: select two or more domains in the dictionary, choose the survivor, and merge; every attribute of the merged domains is reassigned, the merged domains are deleted, and their names become aliases on the survivor's vocabulary entry
  suggestions: the dictionary lists merge candidates: same name in different name modes, same canonical type and parameters, name similarity, and single-use domains
  rename_survivor: optional rename during merge
  conflicts: when merged domains differ in type, components, classification, or perspective notes, the survivor's values win and the merge dialog lists what is dropped before confirming
  curated: the survivor becomes curated; merged automatic domains disappear
  undo: a merge is one undoable operation
checks (data:check-item):
  - domain.single_use: a domain assigned to exactly one attribute, info by default
  - domain.duplicate_candidates: domains that differ only by case or name mode, warning by default
  - domain.uncurated: automatic domains nobody has typed, categorized, or merged, info by default
acceptance:
  - typing a field name and Enter creates the attribute with a same-named domain in one action
  - the field list shows the domain cell filled immediately; unresolved domains render with the unresolved indicator
  - merging three domains updates every column in every table and every DFD payload label without further edits
  - the domain catalog can filter to single-use and duplicate candidates and merge from the list
  - the AI tool surface exposes merge_domains
depends_on:
  - decision:field-first-domains
  - flow:domain-lifecycle
  - data:attribute
  - data:data-domain
  - requirement:domain-dictionary
  - requirement:project-catalogs
  - requirement:configurable-model-checks
  - api:ai-tool-surface
```

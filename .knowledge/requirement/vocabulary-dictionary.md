---
id: requirement:vocabulary-dictionary
type: requirement
title: Project Vocabulary Dictionary
---
Authors must be able to define project vocabulary with business, system, and physical names and bind it to entity, attribute, and domain names so every diagram reads the same term consistently.

```yaml
priority: v1
user_story: As an author, I register "顧客" with system name "Customer" and physical name "customer" once, and every table, column, domain, and DFD label that uses it switches with the name mode.
acceptance:
  - open a vocabulary view listing business, system, and physical names as the primary columns
  - create entries quickly by typing a business name and pressing Enter; IME composition Enter never creates an entry
  - edit meaning, notes, aliases, and see usage for the selected entry
  - bind element names automatically through rule:vocabulary-resolution and show indicators for unregistered, alias, and missing-name segments
  - split an unmatched name into segments and register selected segments as entries
  - rename propagates from the entry to every bound element label
  - registered terms inside C4 element names, descriptions, relationship labels, DFD flow labels, and perspective notes render as links with a hover card and open the entry; no binding or finding is created
  - the entry sidebar lists bindings and mentions separately
  - physical name generation uses matched segments only, follows rule:physical-naming-policy, and reports unmatched text
  - the project chooses english or romaji transliteration, case, and singular or plural in one policy setting
  - suggestions for missing names come from requirement:name-suggestion
  - vocabulary round-trips through project JSON and import
  - AI tools may add entries and completions directly with agent attribution (rule:ai-change-consent)
non_goals:
  - bounded context or context map modeling
depends_on:
  - term:vocabulary
  - data:vocabulary-entry
  - data:vocabulary-binding
  - rule:vocabulary-resolution
  - rule:physical-naming-policy
  - decision:vocabulary-binding-scope
  - requirement:name-display-switching
  - data:c4-project
  - ui:diagram-editor
```

---
id: data:vocabulary-entry
type: data
title: Vocabulary Entry
---
A vocabulary entry is a project-owned term with business, system, and physical names that exists independently of any element using it.

```yaml
fields: id, business_name, system_name, physical_name, physical_name_plural, meaning, notes, aliases, suggestion_state, policy_exception
required_at_creation: business_name
deferred: system_name, physical_name
aliases: synonyms that resolve to this entry but stay flagged for correction
suggestion_state: confirmed | ai_suggested
usage: derived list of elements whose data:vocabulary-binding matches this entry, plus mentions found in C4 names, descriptions, labels, and notes (decision:vocabulary-binding-scope)
constraints:
  - entries are shared by every diagram of the project
  - AI suggestions (data:name-suggestion) never become confirmed without user approval
  - physical_name_plural is required only under a plural rule:physical-naming-policy
  - policy_exception whitelists an entry that intentionally deviates from the policy
  - exact duplicate lookup terms are a validation warning until disambiguated
```

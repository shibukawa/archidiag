---
id: data:vocabulary-binding
type: data
title: Vocabulary Binding
---
A vocabulary binding composes one element name from ordered matched vocabulary entries and explicit unmatched text.

```yaml
owner: data:entity, data:attribute, data:data-domain required; C4 elements optional per decision:vocabulary-binding-scope
fields:
  source_text: the name as typed
  segments:
    - entry_id, matched_text, match_kind: preferred | alias
    - unmatched_text
derived_names:
  business: concatenate business_name of each segment plus unmatched text
  system: concatenate system_name; missing values flagged
  physical: join segment physical names per rule:physical-naming-policy; unmatched text never becomes a physical name
indicators: unregistered | alias_match | missing_system_name | missing_physical_name | complete
constraints:
  - segment boundaries are explicit and user-editable (requirement:vocabulary-dictionary)
  - derived names are computed, never copied into the element
  - rendering reads a cached binding; matching runs on edit, not on render
```

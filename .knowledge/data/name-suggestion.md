---
id: data:name-suggestion
type: data
title: Name Suggestion
---
A name suggestion is a transient candidate for a vocabulary entry's system or physical name, produced by a provider in the project's naming style and never applied without user confirmation.

```yaml
fields: entry_id, target, candidates, rationale, provider, resolution_kind, confidence
target: system_name | physical_name | physical_name_plural | business_alias
resolution_kind: reuse_existing_entry | composed_from_segments | transliterated | translated | new_term
provider: system:name-suggestion-provider identifier
precedence:
  - reuse: a segment already present in the vocabulary reuses its confirmed names
  - compose: multi-segment names compose from confirmed segments before asking a provider
  - provider: only unresolved segments go to translation or transliteration
constraints:
  - confidence ranks candidates and is not a probability
  - a suggestion is not catalog authority; rejection leaves the entry unchanged
  - accepted suggestions are recorded in data:edit-operation with provider attribution
```

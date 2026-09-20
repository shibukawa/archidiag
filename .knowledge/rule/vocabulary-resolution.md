---
id: rule:vocabulary-resolution
type: rule
title: Vocabulary Resolution
---
Name matching prefers the longest matching vocabulary term, preserves unmatched text, and never creates entries or rewrites source text.

```yaml
scope: one project vocabulary
candidates: business_name, aliases
algorithm:
  - start at the beginning of source_text
  - choose the longest matching entry; prefer business_name over alias at equal length
  - emit a data:vocabulary-binding segment and continue after the match
  - keep unmatched text as an unmatched segment
duplicates: exact duplicate lookup terms produce a warning and are never auto-selected
triggers: element rename, vocabulary edit, project import; never on render
constraints:
  - alias matches resolve but remain correction-required
  - whitespace is a hint, not an authoritative boundary; users may split or merge segments
```

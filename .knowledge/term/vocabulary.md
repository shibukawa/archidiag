---
id: term:vocabulary
type: term
title: Vocabulary
---
Vocabulary maps business language to a formal system name and an executable physical name so one element can be read at every abstraction level.

```yaml
names:
  business: language used by domain participants
  system: formal name used in screens and design documents
  physical: identifier used by SQL, code, and generated artifacts
record: data:vocabulary-entry
binding: data:vocabulary-binding
resolution: rule:vocabulary-resolution
display: requirement:name-display-switching
constraints:
  - system names may use any natural language; physical names follow project conventions
  - vocabulary does not model bounded contexts
```

---
id: requirement:name-display-switching
type: requirement
title: Name Display Switching
---
Authors must be able to switch labels among business, system, and physical name forms on any diagram without changing model identity.

```yaml
priority: v1
modes: business | system | physical | system_and_physical
targets: entity, attribute, domain; C4 element labels only when the element opted into binding (decision:vocabulary-binding-scope)
surfaces:
  canvas: one control per diagram view
  inspector: mode selector for the field list
behavior:
  - presentation only; editing identity unchanged
  - missing selected name shows an available name with a missing indicator
  - unmatched segments stay visibly flagged in system and physical modes
  - export uses the active mode and records it in the title block
depends_on:
  - data:vocabulary-binding
  - requirement:vocabulary-dictionary
  - decision:no-logical-physical-split
```

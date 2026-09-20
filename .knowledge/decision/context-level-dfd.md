---
id: decision:context-level-dfd
type: decision
title: Context-Level DFD
---
Support a context-level DFD as its own diagram kind dfd_context; it carries little detail but makes system-level data ownership explicit and completes the C4 pairing at no extra model cost, while container and component levels remain the primary authoring targets.

```yaml
status: accepted 2026-09-20
chosen:
  kind: dfd_context; scope project root; processes are software systems; external entities are people and external systems
  purpose: cross-system data ownership, integration overview, and transaction boundaries that cross systems; entry point for diagram references
  priority: after container and component DFDs
  expected_detail: low; a few flows between systems, people, and external systems
rejected:
  omit_context_level: leaves multi-system data ownership undocumented and breaks zoom symmetry
  derive_only: auto-aggregation from container DFDs is a later enhancement, not a substitute for authoring
consequences:
  - rule:dfd-c4-pairing includes dfd_context as a valid kind
  - no new node roles; software systems are processes at this level only
```

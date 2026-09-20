---
id: decision:checks-over-maturity
type: decision
title: Configurable Checks Instead of Maturity Scores
---
Diagram completeness is expressed as a configurable ladder of check profiles evaluated across C4, ERD, DFD, vocabulary, and domains, not as a fixed maturity score per diagram.

```yaml
status: accepted 2026-09-20
rejected:
  maturity_level_per_diagram: opaque, hard to tailor, and separate per diagram family (erdsketch experience)
chosen:
  check_item: one deterministic rule with a target kind and a default level (data:check-item)
  check_profile: a named step that assigns a level to every item and may extend a previous step (data:check-profile)
  ladder: ordered profiles show progress; the active profile decides what the validation panel reports
  scope: one evaluation covers every diagram kind and dictionary of the project
consequences:
  - rule:c4-model-integrity errors stay fixed; profiles tune only completeness checks
  - export readiness warnings from rule:erd-scope-integrity and data:dfd-transaction-boundary become check items
  - profiles are project data with JSON import and export so teams share their ladder
```

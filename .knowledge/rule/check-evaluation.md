---
id: rule:check-evaluation
type: rule
title: Check Evaluation
---
Validation evaluates integrity rules as fixed errors and every check item at the level given by the active profile, then reports results per diagram, per family, and as ladder progress.

```yaml
inputs: data:c4-project, active data:check-profile, ladder of profiles
evaluation:
  - integrity: rule:c4-model-integrity, rule:erd-scope-integrity, rule:dfd-reference-integrity, rule:group-membership always error
  - items: resolve level via profile -> extends chain -> default_level; skip off
  - each finding: item id, level, target, diagram, message, quick fix when available
grouping:
  - by diagram with navigation to the target
  - by family and item with counts
progress:
  - per profile in the ladder: passing item ratio and blocking count
  - next_step: failing items of the profile after the active one
timing: debounced on model change; full run on demand and before export
constraints:
  - evaluation never mutates the model
  - a finding for a hidden or collapsed target still navigates to it
  - AI tools receive the same findings through validate_project
```

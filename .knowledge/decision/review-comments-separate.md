---
id: decision:review-comments-separate
type: decision
title: Review Comments Outside the Model
---
Review discussions are stored as separate thread records beside the model, not as perspective notes, so conversational data never enters the model files or the design bundle by default.

```yaml
status: accepted 2026-09-20
rejected:
  threads_as_perspective_notes: notes are design knowledge that belongs in the model file; threads are transient and would bloat diffs
chosen:
  record: data:review-thread stored under <project>/reviews/ on disk, in browser storage locally, and synchronized by system:bun-server in shared sessions
  targets: any deep-linkable target (requirement:deep-links)
  lifecycle: open | resolved; resolved threads are excluded from exports unless requested
  priority: requirement:review-comments in v2
consequences:
  - model YAML and JSON stay free of discussion data
  - a resolved thread may be promoted into a perspective note by the user
```

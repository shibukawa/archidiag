---
id: data:review-thread
type: data
title: Review Thread
---
A review thread is a discussion attached to one deep-linkable target, stored beside the model and never inside it.

```yaml
fields: id, target_url, state, created_by, created_at, comments
comment: id, author, body, created_at, edited_at
state: open | resolved
storage: decision:review-comments-separate
constraints:
  - target_url follows requirement:deep-links and survives rename
  - a thread whose target is deleted stays readable as orphaned
  - promotion to a data:perspective-note copies the body and keeps the thread
```

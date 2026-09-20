---
id: requirement:review-comments
type: requirement
title: Review Comment Threads
---
Reviewers should be able to open comment threads on any target, resolve them, and promote conclusions into perspective notes, without the threads entering the model files.

```yaml
priority: v2
acceptance:
  - add a thread from any selectable target or deep link; reply, edit own comments, resolve and reopen
  - unresolved thread count shows as a badge; a review panel lists threads with filters
  - threads sync in shared sessions and persist locally otherwise
  - promote a thread into a data:perspective-note under a chosen perspective
  - bundle export can include open threads as an appendix
depends_on:
  - decision:review-comments-separate
  - data:review-thread
  - requirement:deep-links
  - requirement:perspectives
  - system:bun-server
```

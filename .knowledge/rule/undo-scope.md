---
id: rule:undo-scope
type: rule
title: Undo Covers Own Operations Only
---
Undo and redo act only on the current actor's own operations, in local and shared sessions alike; other participants' changes are never undone implicitly and are reverted only through explicit history actions.

```yaml
local:
  stack: the user's operations in this session, including batches from an agent acting as this user
  text_edits: keystrokes into one text field coalesce into one step while the field keeps focus; blur, a different target, or undo closes the batch, so undo reverts the whole edit session rather than one character
  toggles: a checkbox, radio, or reorder is always its own step
shared:
  stack: per participant; undo emits the inverse of the participant's latest own operation as a new data:edit-operation
  conflicts: if a later operation by someone else touched the same target, undo is refused with a pointer to that operation
  agent: an agent acting as a user shares that user's stack; its batches undo as one
history:
  revert: any operation in the journal can be reverted by anyone with edit rights as a new attributed operation
  no_global_undo: there is no "undo last change by anyone" action
constraints:
  - undo never rewrites the journal; it appends
  - redo is cleared when the participant makes a new operation
```

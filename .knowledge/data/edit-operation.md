---
id: data:edit-operation
type: data
title: Edit Operation
---
An edit operation is a validated atomic change to data:c4-project with an actor, timestamp, target, and reversible intent.

```yaml
fields: operation_id, actor_id, kind, payload, base_revision, created_at
requirements:
  - deterministic validation
  - idempotent application where feasible
  - undo or inverse representation
  - origin attribution: human or AI
```

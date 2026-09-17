---
id: flow:collaborative-editing
type: flow
title: Collaborative Editing Flow
---
Collaborators join an optional shared session, exchange validated operations, and keep a convergent local view.

```yaml
flow:
  trigger: actor:collaborator joins data:collaboration-session
  steps:
    - id: connect
      action: negotiate api:collaboration-gateway
    - id: sync
      action: receive authoritative snapshot and missing data:edit-operation records
    - id: edit
      action: apply local command and submit a validated operation
    - id: broadcast
      action: distribute accepted operation and update presence
    - id: recover
      action: replay or reconcile after reconnect
  failure:
    conflict: preserve user data and surface a resolvable state
```

---
id: requirement:optional-collaboration
type: requirement
title: Optional Real-Time Collaboration
---
When system:collaboration-service is configured, multiple users must edit one project with synchronized changes; when it is absent, the core editor remains usable.

```yaml
priority: v1
acceptance:
  - create or join a named session
  - show participant presence and connection state
  - converge on the same valid project after concurrent edits
  - attribute accepted changes to participants
  - recover from disconnect and reconnect without silent data loss
  - enforce read_only access when the session grants it
  - undo affects only the participant's own operations (rule:undo-scope)
non_goals:
  - make a specific backend vendor mandatory; system:bun-server is the reference, the gateway stays abstract
depends_on:
  - system:collaboration-service
  - data:collaboration-session
  - data:edit-operation
  - api:collaboration-gateway
```

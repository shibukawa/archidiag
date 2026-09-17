---
id: data:collaboration-session
type: data
title: Collaboration Session
---
The collaboration session binds a project to participants, revisions, presence, permissions, and synchronized data:edit-operation records.

```yaml
fields: session_id, project_id, participants, revision, presence, permission_policy
participant:
  fields: participant_id, display_name, color, role, last_seen
session_states:
  - connecting
  - connected
  - reconnecting
  - read_only
  - closed
```

---
id: data:collaboration-session
type: data
title: Collaboration Session
---
The collaboration session binds a project to participants, revisions, presence, permissions, and synchronized data:edit-operation records.

```yaml
fields: session_id, project_id, participants, revision, presence, permission_policy
participant:
  fields: participant_id, user_id, kind, display_name, color, role, last_seen
  kind: human | agent
  agent: acts as the user_id that attached it; role and permissions are the user's (rule:ai-change-consent)
session_states:
  - connecting
  - connected
  - reconnecting
  - read_only
  - closed
```

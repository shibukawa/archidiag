---
id: rule:ai-change-consent
type: rule
title: AI Edits Without Approval Gates
---
An AI agent is one more editor of the project: its mutations apply directly like browser edits, with no proposal or approval step, and safety comes from attribution, validation, history, and undo.

```yaml
apply: mutation tools run through the same validated command path as manual edits and take effect immediately
no_gate:
  - no proposal state, preview requirement, or accept/reject step
  - bulk edits are one data:edit-operation batch so they undo as one
identity:
  local: the agent acts as the local user
  shared_session: the agent acts as the logged-in user who attached it; edits carry that user plus an agent marker
  permissions: the agent inherits the user's session permissions, including read_only
visibility:
  - every AI edit is attributed in history, presence, and the activity panel
  - connected browsers see AI edits live like any collaborator's
  - requirement:webmcp-edit-logging records each accepted edit
recovery: undo, redo, and journal revert cover AI edits exactly like human edits, within the attached user's own stack (rule:undo-scope)
```

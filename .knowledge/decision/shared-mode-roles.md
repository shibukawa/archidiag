---
id: decision:shared-mode-roles
type: decision
title: Shared-Mode Roles and Authentication
---
Roles and authentication for shared mode are not decided; local mode has no login and no roles, and shared mode keeps only the read_only versus edit distinction until a real deployment case defines more.

```yaml
status: open
decided:
  local: no login, single implicit owner
  shared_minimum: participant identity plus read_only | edit per session (data:collaboration-session)
undecided:
  - whether a login is required at all for LAN use, or a shared link token suffices
  - identity source: static user list, external provider, or reverse proxy headers
  - whether owner or admin rights exist for settings such as check profiles, theme, and naming policy
  - per-project versus per-server access
inputs_needed: the first multi-user deployment scenario
constraints:
  - nothing in the model or the CLI depends on roles beyond read_only | edit
  - rule:undo-scope and rule:ai-change-consent hold under any future role model
```

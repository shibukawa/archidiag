---
id: api:collaboration-gateway
type: api
title: Collaboration Gateway
---
The collaboration gateway is a transport-neutral boundary for session lifecycle, snapshots, data:edit-operation exchange, presence, and permissions.

```yaml
operations:
  - create_session
  - join_session
  - leave_session
  - get_snapshot
  - submit_operation
  - subscribe_operations
  - publish_presence
  - update_permission
guarantees:
  - explicit connection state
  - ordered or revision-addressable operations
  - server-side authorization when a service exists
  - no dependency from the static baseline on this API
reference_implementation: system:bun-server over WebSocket speaking the Yjs sync and awareness protocol (decision:crdt-collaboration); updates persist to data:project-store
```

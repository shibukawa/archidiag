---
id: system:collaboration-service
type: system
title: Optional Collaboration Service
---
The optional collaboration service provides session coordination, shared change synchronization, presence, and access control without being required by the static editor; its reference implementation is system:bun-server.

```yaml
required_capabilities:
  - api:collaboration-gateway
transport: WebSocket in the reference implementation; browser client depends only on the abstract gateway
authority: decision:server-authority-when-present
```

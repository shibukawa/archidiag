---
id: system:collaboration-service
type: system
title: Optional Collaboration Service
---
The optional collaboration service provides session coordination, shared change synchronization, presence, and access control without being required by the static editor.

```yaml
required_capabilities:
  - api:collaboration-gateway
transport: implementation choice; browser client must depend on an abstract gateway
authority: shared session state and access policy
```

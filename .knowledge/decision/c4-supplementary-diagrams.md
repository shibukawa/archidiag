---
id: decision:c4-supplementary-diagrams
type: decision
title: C4 Supplementary Diagrams
---
System Landscape is covered by c4_context at the project root, Dynamic diagrams are out of scope because dfd_* serves a different purpose, and Deployment is deferred to a v2 diagram kind.

```yaml
status: accepted 2026-09-20
landscape:
  decision: no new kind; c4_context with scope root already shows multiple software systems
dynamic:
  decision: out of scope; dfd_* gives the rough flow of a use case but is not a one-to-one substitute
  rationale: dfd_* shows where use-case data reaches and where transaction boundaries lie (data:dfd-transaction-boundary) and deliberately has no ordering; a dynamic or sequence diagram adds order and request/response detail that DFD does not carry
  future: a dynamic kind may be added later without touching dfd_*
deployment:
  decision: defer to requirement:deployment-diagram as kind deploy_container in v2
  rationale: fits decision:no-logical-physical-split by holding infrastructure choices, but ranks below ERD, DFD, vocabulary, and domains
```

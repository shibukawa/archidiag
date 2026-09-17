---
id: requirement:external-context-visibility
type: requirement
title: Show External Context in Nested Views
---
Entering a child C4 view must retain relevant external context outside the selected system boundary.

```yaml
priority: mvp
acceptance:
  - Container view for a software system shows its containers inside a labeled boundary
  - connected people and external systems remain visible outside that boundary
  - Commerce Platform Container view shows Customer and Payment Provider outside the boundary
  - Component view preserves relevant inherited context and direct external dependencies
  - Customer connects to the Web Application container in the Commerce Platform Container view
  - inherited system-level relationships use explicit visible child endpoints when available
  - the system boundary is never a relationship endpoint
  - unrelated external elements are not added to the view
depends_on:
  - requirement:hierarchical-modeling
  - data:c4-project
  - rule:external-context-boundary
```

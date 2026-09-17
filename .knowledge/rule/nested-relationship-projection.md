---
id: rule:nested-relationship-projection
type: rule
title: Project Relationships Into Nested Views
---
Nested diagrams must render relationships between visible elements rather than connecting the system boundary.

```yaml
projection:
  direct: retain endpoints visible in the current view
  descendant: promote a hidden descendant endpoint to its nearest visible ancestor
  explicit: allow a per-level endpoint mapping when domain semantics identify a specific child
example:
  context: Customer -> Commerce Platform
  container: Customer -> Web Application
boundary:
  endpoint: forbidden
  fallback: omit the relationship when no visible endpoint can be resolved
```

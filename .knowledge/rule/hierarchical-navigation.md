---
id: rule:hierarchical-navigation
type: rule
title: Hierarchical Navigation and Shared Identity
---
Child diagrams are navigable views of canonical parent elements, so entering a child scope and renaming an element never creates a detached copy.

```yaml
navigation:
  context_software_system: open container view with scope_id equal to the system id
  container_container: open component view with scope_id equal to the container id
  breadcrumb: show project root and ancestor names
  back: restore the previous diagram and selection when possible
identity:
  - diagram views store element refs, not duplicated element records
  - all labels resolve from the canonical element record
  - rename is one model operation and invalidates affected views
non_navigable:
  - people and external systems have no child scope by default
```

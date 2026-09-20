---
id: requirement:element-lifecycle-status
type: requirement
title: Existing, Planned, and Deprecated Status
---
Authors must be able to mark elements, relationships, entities, and flows as existing, planned, or deprecated, render them distinctly, filter views to as-is or to-be, and check transitions.

```yaml
priority: v1
user_story: As an author, I add a planned Recommendation Service; it renders dashed, the as-is filter hides it, and a check warns that an existing container now depends on a planned one.
acceptance:
  - set the lifecycle value from the inspector or a canvas context menu; default is existing
  - planned renders dashed, deprecated renders gray with a badge, on every diagram kind and in exports
  - a view filter shows as-is (existing plus deprecated), to-be (existing plus planned), or all
  - the document bundle can be exported for as-is or to-be
  - checks: lifecycle.existing_depends_on_planned, lifecycle.deprecated_still_written (a deprecated table written by an existing process), lifecycle.planned_without_description
  - catalogs and analysis show the status column
depends_on:
  - decision:status-and-classification-as-perspectives
  - data:perspective
  - data:perspective-note
  - requirement:perspectives
  - requirement:multiple-views-per-scope
  - requirement:configurable-model-checks
```

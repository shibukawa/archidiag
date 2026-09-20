---
id: requirement:hierarchical-modeling
type: requirement
title: Hierarchical C4 Modeling
---
The editor must make the C4 hierarchy feel like entering and leaving nested scopes rather than switching between unrelated diagrams.

```yaml
priority: mvp
user_story: As an author, I double-click a software system or container to see the next C4 level inside it.
acceptance:
  - System Context shows software systems as navigable parent nodes
  - double-clicking a software system opens its container scope
  - double-clicking an application container opens its component scope
  - double-clicking a database or database schema container opens erd_component, and double-clicking an entity opens erd_code (requirement:erd-in-data-store)
  - the current scope and ancestors are visible
  - back or breadcrumb navigation returns to the parent view
  - nested views retain relevant people and external systems outside the current system boundary
  - renaming a system or container updates every linked view immediately
  - deleting a parent explains the impact on child scopes before confirmation
depends_on:
  - requirement:three-c4-layers
  - data:c4-project
  - rule:c4-model-integrity
  - rule:hierarchical-navigation
  - ui:diagram-editor
```

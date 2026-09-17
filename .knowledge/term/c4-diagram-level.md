---
id: term:c4-diagram-level
type: term
title: C4 Diagram Level
---
The product supports C4 System Context, Container, and Component diagrams; C4 Code diagrams are outside the initial scope.

```yaml
levels:
  - id: context
    name: System Context
    scope: system and its people and external systems
  - id: container
    name: Container
    scope: applications and data stores inside a system
  - id: component
    name: Component
    scope: components inside a container
out_of_scope:
  - code
navigation: drill_down and drill_up between related scopes
```

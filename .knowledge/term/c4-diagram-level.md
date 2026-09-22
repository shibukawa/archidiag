---
id: term:c4-diagram-level
type: term
title: C4 Diagram Level
---
The product supports C4 System Context, Container, Component, and, for data stores only, Code level; Code level for application components is out of scope.

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
    scope: components inside an application container (c4_component), or independent entities inside a data store (erd_component)
  - id: code
    name: Code
    scope: an entity and its dependent entities (erd_code, data:entity)
    application_components: out_of_scope
paired_dfd_view: dfd_container at container level only (decision:dfd-container-level-only)
navigation: drill_down and drill_up between related scopes
```

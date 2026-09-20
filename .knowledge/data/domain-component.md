---
id: data:domain-component
type: data
title: Domain Component
---
A domain component is one ordered member of a multi-field data:data-domain.

```yaml
fields: name, type_reference, required, description
type_reference: data:primitive-type or a defined single_field data:data-domain; undefined allowed while editing
constraints:
  - names are unique within a domain
  - order is stable and controls column order in rule:domain-expansion
  - nested composite domains are excluded in v1
```

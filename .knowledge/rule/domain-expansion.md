---
id: rule:domain-expansion
type: rule
title: Domain Expansion and Key Projection
---
A domain assignment stays one logical attribute while physical projection produces one column per component and projects key flags across those columns in component order.

```yaml
scalar_domain:
  columns: 1
  name: attribute physical name
composite_domain:
  columns: component count
  name: attribute physical name + component physical name
  order: component order
keys:
  primary_key: ordered composite primary key over projected columns
  reference: data:entity-relationship reference projects the referenced key's columns onto the many side with the same order and compatible types
incomplete:
  logical_assignment: preserved
  physical_projection: export readiness error, never a blocking edit error
constraints:
  - projected columns carry the domain's canonical type inline; the domain name never appears in DDL except as a comment
  - projected columns keep source attribute, domain, and component identity
  - name conflicts are reported before export
  - expansion is derived and never stored as extra attributes
```

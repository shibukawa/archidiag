---
id: data:data-domain
type: data
title: Data Domain
---
A data domain is a named reusable logical type that is the single authority for the type of every attribute assigned to it; it is a modeling concept only and is never emitted as a SQL DOMAIN.

```yaml
fields: id, name, name_binding, category_id, origin, curated, definition_state, shape, primitive_type, parameters, components, code_set, description
origin: from_field | dictionary | built_in
curated: false for automatic domains until an author types, categorizes, merges into, or describes them; true afterwards
definition_state: unresolved | defined
shape:
  built_in_primitive: data:primitive-type entry
  single_field: one primitive type with parameters
  multi_field: ordered data:domain-component list
  code_set: data:code-set
examples:
  user_id: surrogate key domain, single_field bigint or uuid
  user_code: natural key domain, single_field varchar length 6
  customer_code: multi_field [tenant_id, user_code]
lifecycle: flow:domain-lifecycle (decision:field-first-domains)
constraints:
  - field entry and dictionary quick entry both yield definition_state unresolved with undefined type
  - unresolved and empty composite domains are assignable
  - a composite domain is one logical attribute in editing and one column per component in physical projection (rule:domain-expansion)
  - domain definition changes propagate to every assignment
  - the stored type is canonical PostgreSQL; dialect rendering happens only at export (decision:postgresql-canonical-types)
  - physical projection substitutes the domain's type inline into each column; no CREATE DOMAIN, user-defined type, or type alias is generated
  - categories are a flat user-named list plus built_in_primitive
```

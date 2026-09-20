---
id: data:attribute
type: data
title: Attribute
---
An attribute is one column definition of data:entity that carries its business name, system name, physical name, domain, and physical projection in a single record.

```yaml
fields: id, entity_id, name, name_binding, use_domain_name, domain_id, required, unique, primary_key, key_kind, default, value_generation, description, order
name_binding: data:vocabulary-binding derived from name by rule:vocabulary-resolution
use_domain_name: default false; when true the effective name is name + domain name without separator and an empty name is allowed; useful after consolidation, for example Article + CreatedAt
domain_id: data:data-domain reference; domain definition is the type authority; quick entry assigns the domain named like the field (requirement:domain-consolidation)
default:
  kinds: none | literal | current_date | current_timestamp
  literal_types: string | number | boolean
key_kind: none | surrogate | natural; surrogate columns end with _id and natural columns with _code per rule:physical-naming-policy
value_generation: none | auto_increment | uuid | sequence; surrogate keys normally generate, natural keys never do
physical_projection:
  columns: rule:domain-expansion; one column for a scalar domain, one per component for a composite domain
  column_name: physical_name segments from the binding plus component names
  column_type: canonical PostgreSQL type from the domain, rendered per the data store's data:sql-dialect-mapping at export
constraints:
  - primary_key implies required for physical projection
  - a surrogate key is the default primary key; a natural key is unique and becomes primary only when no surrogate exists
  - unique describes one attribute; composite keys are the ordered primary_key attributes
  - foreign keys come from data:entity-relationship, never from an attribute flag
  - an unresolved domain is valid for editing and reported only by export readiness
```

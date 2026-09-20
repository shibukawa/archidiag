---
id: decision:postgresql-canonical-types
type: decision
title: PostgreSQL as Canonical Type System
---
Physical column types are modeled once in PostgreSQL terms, and every other SQL target is produced by a declarative dialect mapping at export time, so a domain defined as varchar(5) stays varchar(5) in the model and becomes text in SQLite output.

```yaml
status: accepted 2026-09-20
canonical:
  type_vocabulary: data:primitive-type expressed with PostgreSQL names and parameters
  storage: data:data-domain holds the canonical type; no per-dialect copies
targets:
  mapping: data:sql-dialect-mapping per dialect; built-in postgresql (identity), sqlite, mysql
  selection: each data store container names its dialect; export and checks use it
rejected:
  per_dialect_domain_definitions: duplicates every domain and drifts
  lowest_common_denominator_types: loses precision the author already decided
consequences:
  - domains are logical: DDL substitutes each column's type from its domain and never emits CREATE DOMAIN
  - mappings may be lossy; export writes the canonical type as a comment and checks report the loss (data:check-item domain.lossy_dialect_mapping)
  - adding a dialect means adding one mapping file, not touching domains
  - the model stays valid when a data store's dialect changes; only export output changes
```

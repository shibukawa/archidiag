---
id: data:primitive-type
type: data
title: Primitive Type
---
A primitive type is a canonical base type expressed in PostgreSQL terms and available in the domain dictionary; other dialects render it through data:sql-dialect-mapping.

```yaml
canonical_system: postgresql (decision:postgresql-canonical-types)
kinds:
  integer: smallint | integer | bigint; signed only, unsigned is a check constraint
  decimal: numeric(precision, scale)
  floating_point: real | double precision
  varchar: varchar(length)
  text: text
  blob: bytea
  date: date
  time: time
  datetime: timestamp
  datetime_with_timezone: timestamptz
  boolean: boolean
  uuid: uuid
  json: jsonb
  code_set: data:code-set with base varchar | integer | numeric
constraints:
  - parameters follow PostgreSQL semantics; dialects decide whether to keep them
  - primitives appear as built_in_primitive entries of data:data-domain
  - a dialect rule exists for every kind in every built-in mapping
```

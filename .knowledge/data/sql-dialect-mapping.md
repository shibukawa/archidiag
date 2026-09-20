---
id: data:sql-dialect-mapping
type: data
title: SQL Dialect Mapping
---
A dialect mapping declares how each canonical PostgreSQL type, parameter, default, and key construct is rendered for one target database, including whether the rendering loses information.

```yaml
fields: id, name, version, type_rules, default_rules, key_rules, naming_rules, builtin
type_rule:
  fields: canonical_kind, target_type, keep_parameters, lossy, note
  examples:
    sqlite:
      varchar(n): text; keep_parameters false; lossy true
      integer(64): integer
      decimal(p,s): numeric; lossy true
      boolean: integer 0/1; lossy true
      uuid: text; lossy true
      datetime_with_timezone: text iso8601; lossy true
      json: text; lossy true
    mysql:
      varchar(n): varchar(n)
      text: text
      boolean: tinyint(1); lossy true
      uuid: char(36); lossy true
      datetime_with_timezone: datetime; lossy true
      json: json
default_rules:
  current_timestamp: per dialect expression
  literal: quoting per dialect
key_rules:
  auto_increment: postgresql identity | sqlite integer primary key autoincrement | mysql auto_increment
  composite_primary_key: supported flag per dialect
  foreign_key: emit inline or as constraint; on_delete support
naming_rules:
  identifier_quote: '"' | '`'
  max_identifier_length: per dialect
constraints:
  - every canonical kind has exactly one rule per dialect; missing rules are an export error
  - built-in mappings are read-only; a project may add an override mapping that extends a built-in one
  - lossy rules emit the canonical type as a trailing comment in DDL
```

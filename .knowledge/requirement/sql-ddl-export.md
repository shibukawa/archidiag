---
id: requirement:sql-ddl-export
type: requirement
title: SQL DDL Export per Data Store Dialect
---
Authors must be able to export DDL for one data store in its selected dialect, with canonical PostgreSQL types substituted through the dialect mapping and lossy conversions made visible.

```yaml
priority: v1
user_story: As an author, I model UserId as varchar(5), mark the Orders schema as SQLite, and export DDL where the column is text with a comment noting varchar(5).
acceptance:
  - choose a dialect per data store container: postgresql, sqlite, mysql
  - export DDL for one data store or for every data store in the project
  - tables come from independent and dependent entities; columns from rule:domain-expansion with the domain's type substituted inline, never a SQL DOMAIN or user-defined type
  - surrogate primary keys use the dialect's identity or uuid generation; natural keys emit unique constraints
  - primary keys, foreign keys from reference relationships, cascade for dependent relationships, unique constraints, defaults, and value generation follow the dialect's key and default rules
  - physical names come from vocabulary physical names joined per rule:physical-naming-policy; unresolved names block export with a finding
  - table names use physical_name_plural when the policy is plural
  - lossy type conversions add a trailing comment with the canonical type and appear as info findings
  - table order respects foreign key dependencies
  - inherit relationships copy parent columns into the child table
  - export output is deterministic for the same model
non_goals:
  - CREATE DOMAIN or user-defined types; domains are logical only
  - migrations or diffs between versions
  - dialect-specific features such as partitions or storage engines in v1
depends_on:
  - decision:postgresql-canonical-types
  - data:sql-dialect-mapping
  - data:primitive-type
  - data:data-domain
  - data:attribute
  - data:entity-relationship
  - rule:domain-expansion
  - requirement:vocabulary-dictionary
  - requirement:configurable-model-checks
```

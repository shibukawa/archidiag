---
id: decision:project-schema-versioning
type: decision
title: Project Schema Versioning
---
schema_version is the version of the project data format, meaning the JSON shape and the YAML folder layout of data:c4-project, independent of the application version; it changes only when stored data changes shape and every change ships with a migration in the shared core.

```yaml
status: accepted 2026-09-20
what_it_versions: record fields, enum values, diagram kinds, file layout of data:project-store
what_it_does_not_version: application releases, UI, check items, style themes (these carry their own ids)
numbering: single integer, incremented per breaking or additive change; stored in c4sketch.yaml and in the JSON file
migration:
  location: decision:shared-typescript-core as pure functions version N -> N+1, chained
  when: on import, on open, and by the CLI migrate command; the file on disk is rewritten only on save or explicit migrate
  newer_file: refused with the required application version
  older_file: migrated in memory; a notice offers to save in the current version
tests: every starter project is kept in each historical version and migrated in CI
compatibility_promise: additive changes keep older readers working when unknown keys are ignored; breaking changes bump the version
```

---
id: requirement:starter-projects
type: requirement
title: Starter and Sample Projects
---
The editor must offer built-in starter projects that open in one click, show every feature with realistic content, and run in CI as fixtures for validation, checks, exports, and DDL.

```yaml
priority: v1
acceptance:
  - the start screen lists Blank and the Commerce Platform starter with a summary and preview image
  - opening a starter creates a new local project copy; the fixture itself is never modified
  - the starter covers c4_*, erd_*, dfd_* kinds, multiple views, groups, perspectives, vocabulary, domains, dialects, and transaction boundaries
  - business names are Japanese with English system and physical names so name switching and suggestions are demonstrable
  - CI loads every starter, runs integrity rules and the full check ladder, exports JSON, SVG, DDL for each dialect, and the document bundle, and fails on any error or output change without a fixture update
  - starters are the default context for guided first-run hints and for AI agents exploring the tool
  - starters are versioned with schema_version and migrated by the same import path as user files
depends_on:
  - data:starter-project
  - requirement:project-portability
  - requirement:configurable-model-checks
  - requirement:sql-ddl-export
  - requirement:document-bundle-export
  - requirement:browser-editing
```

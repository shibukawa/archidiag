---
id: requirement:headless-cli
type: requirement
title: Headless CLI and Agent Skill
---
The product must ship a CLI that runs the shared core without a server or browser for checks, exports, DDL, bundles, format conversion, and queries, with machine-readable output so CI and agent skills can call it.

```yaml
priority: v1
binary: bunx c4sketch <command> [project-dir]
commands:
  serve: start system:bun-server on a folder (default when no command)
  check: run integrity rules and a chosen check profile; exit code reflects errors
  export: svg | png | pdf | drawio for one view or all views
  ddl: DDL for one data store or all, per dialect
  bundle: requirement:document-bundle-export in html or markdown
  convert: yaml folder <-> json file (decision:yaml-on-disk-json-in-browser)
  query: list or get elements, views, entities, dfds, usage, findings as JSON
  apply: apply a JSON batch of data:edit-operation records, validated, attributed to the CLI user
  diff: compare two folders or files and print changed records
  migrate: upgrade a folder or file to the current schema_version (decision:project-schema-versioning)
output:
  human: tables and summaries
  json: --json for every command; stable schemas shared with api:ai-tool-surface results
skill_integration:
  - a bundled agent skill description (SKILL.md or equivalent) documents the commands so coding agents can call the CLI from a repository without MCP
  - query and apply give agents the same capabilities as api:mcp-server when no server runs
acceptance:
  - every command runs on a YAML folder or a JSON file without network access
  - check exits non-zero on errors and prints findings in the selected format
  - export and bundle produce the same bytes as the browser for the same model and layout
  - apply rejects invalid batches without partial writes and appends to the journal
  - apply, convert, and migrate refuse to run while a server holds the folder lock, with a message naming the server; the server refuses to start on a folder locked by a CLI write
  - a coding agent can complete a modeling task using only query and apply
  - CI for starters (requirement:starter-projects) uses this CLI
depends_on:
  - decision:shared-typescript-core
  - decision:yaml-on-disk-json-in-browser
  - data:project-store
  - rule:check-evaluation
  - requirement:sql-ddl-export
  - requirement:document-bundle-export
  - api:ai-tool-surface
  - system:bun-server
```

---
id: requirement:document-bundle-export
type: requirement
title: Project Document Bundle Export
---
Authors must be able to export the whole project as one navigable document that combines every view, catalog, table definition, DFD, perspective note, and check result, for review and for attaching to pull requests.

```yaml
priority: v1
formats:
  html: single self-contained file with embedded SVG views, in-page navigation, and search
  markdown: folder of Markdown files plus SVG images, Git-friendly, one file per scope
structure:
  - project overview: name, version, active check profile summary
  - C4 section per scope: default view plus other views, element table with descriptions and technology, relationships
  - data section per data store: erd_component view, table definitions with columns, domains, keys, relationships, erd_code views, DDL in the store's dialect
  - DFD section per use case: views by level, flows with payloads and operations, transaction boundaries
  - catalogs: vocabulary, domains, tables, DFDs (requirement:project-catalogs)
  - perspectives: notes grouped by perspective with links to targets
  - findings: results of the active profile grouped by diagram
options:
  scope: whole project, one software system, or one data store
  name_mode: business | system | physical | system_and_physical
  include: toggle sections; deterministic ordering for stable diffs
acceptance:
  - one action exports the bundle from the browser on the static build; the server offers the same through data:project-store exports and an MCP resource
  - every view appears as SVG in its saved layout with its title block and legend (rule:diagram-frame)
  - cross-references are links: element to views, table to DFD usage, note to target
  - the same model exports byte-identical output twice
  - large projects export progressively without freezing the editor
depends_on:
  - decision:no-whole-project-diagram
  - requirement:diagram-export-formats
  - requirement:sql-ddl-export
  - requirement:project-catalogs
  - requirement:perspectives
  - rule:check-evaluation
  - requirement:name-display-switching
  - api:mcp-server
```

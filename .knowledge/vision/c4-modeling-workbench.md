---
id: vision:c4-modeling-workbench
type: vision
title: Browser C4 Modeling Workbench
---
Build a browser-first architecture workbench centered on C4 diagrams where data stores zoom into ERDs, use-case DFDs pair with every C4 level, and a shared vocabulary and domain dictionary keep names and types consistent, on static hosting with optional shared and AI-assisted editing.

```yaml
scope:
  supported_levels:
    - term:c4-diagram-level
  diagram_families: term:diagram-family
  philosophy: decision:no-logical-physical-split
  growth_path:
    - requirement:vocabulary-dictionary
    - requirement:domain-dictionary
    - requirement:erd-in-data-store
    - requirement:use-case-dfd
    - requirement:multi-diagram-project
    - requirement:element-groups
    - requirement:perspectives
    - requirement:configurable-model-checks
    - requirement:sql-ddl-export
    - requirement:multiple-views-per-scope
    - requirement:element-analysis-view
    - requirement:name-suggestion
    - requirement:project-catalogs
    - requirement:auto-layout
    - requirement:layout-helpers
    - requirement:document-bundle-export
    - requirement:starter-projects
    - requirement:headless-cli
    - requirement:element-lifecycle-status
    - requirement:data-classification
    - requirement:deep-links
    - requirement:ui-localization
    - requirement:description-display
    - requirement:perspective-view
    - requirement:canvas-quick-create
    - requirement:domain-consolidation
    - requirement:bun-backend
    - requirement:mcp-server-access
  deferred:
    - requirement:review-comments
    - requirement:deployment-diagram
  primary_actors:
    - actor:diagram-author
    - actor:collaborator
    - actor:ai-agent
  deployment_baseline: system:github-pages-host
  optional_runtime: system:bun-server (collaboration and MCP)
```

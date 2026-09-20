---
id: requirement:element-analysis-view
type: requirement
title: Cross-Diagram Element Analysis
---
Authors must be able to open an analysis view for any element, table, domain, or vocabulary entry that shows its relationships, DFD roles, table reads and writes, dictionary use, annotations, and findings across the whole project.

```yaml
priority: v1
user_story: As an author, I select the Order Service container and see which containers it talks to, every DFD it appears in, and that it creates Orders and reads Products; selecting the Orders table shows which processes write it and under which transaction boundaries.
acceptance:
  - open analysis from the inspector, the explorer, or a canvas context menu
  - show the sections of data:element-usage with counts in section headers
  - process elements list read and written entities with operations aggregated over all DFDs
  - entities and data stores list reading and writing processes with operations and transaction boundaries
  - relationships list where each one is visible and where it is missing from a view
  - every row navigates to the owning view, DFD, dictionary entry, or note and highlights the target
  - filter rows by view kind, DFD use case, perspective, or operation
  - the analysis is available for domains and vocabulary entries as reverse usage
  - export the analysis as Markdown for one element or for all elements of a scope
  - the AI tool surface exposes get_element_usage returning the same projection
depends_on:
  - data:element-usage
  - data:diagram-view
  - data:dfd-model
  - data:dfd-transaction-boundary
  - data:entity
  - data:perspective-note
  - rule:check-evaluation
  - requirement:crud-matrix
  - api:ai-tool-surface
  - ui:diagram-editor
```

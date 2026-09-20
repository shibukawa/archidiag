---
id: requirement:project-catalogs
type: requirement
title: Project-Wide Catalogs
---
Authors must be able to browse vocabulary, domains, tables, and DFDs as project-wide lists that span every data store and diagram, with search, filters, sorting, navigation, and tabular export.

```yaml
priority: v1
catalogs:
  vocabulary: data:vocabulary-entry rows with business, system, physical names, usage count, indicators
  domains: data:data-domain rows with origin, curated, category, shape, canonical type, dialect renderings, assignment count, merge candidates
  tables: every data:entity across all data stores with data store, dialect, classification, independent or dependent, owner, key kinds, attribute count, views, DFD read and write counts, findings
  dfds: every data:diagram-view of a dfd_* kind with kind, scope, use case, node and flow counts, transaction boundaries
acceptance:
  - open each catalog from the explorer; the table catalog groups or filters by data store
  - search across name modes; filter by data store, classification, dialect, group, perspective, finding level
  - sort by any column; column set is user-adjustable and remembered per browser
  - a row opens the element's default view, its analysis view, or its dictionary entry
  - bulk actions where safe: assign classification, assign group, run suggestions, set dialect per data store
  - export any catalog as CSV or Markdown in the active name mode
  - catalogs are derived and update live with the model
depends_on:
  - decision:no-whole-project-diagram
  - data:vocabulary-entry
  - data:data-domain
  - data:entity
  - data:diagram-view
  - data:element-usage
  - requirement:name-display-switching
  - requirement:element-analysis-view
  - ui:diagram-editor
```

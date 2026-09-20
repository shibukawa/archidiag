---
id: decision:no-whole-project-diagram
type: decision
title: No Whole-Project Diagram
---
The product does not offer one combined diagram of C4, ERD, and DFD; project-wide understanding comes from catalog lists, the element analysis view, and per-scope views instead.

```yaml
status: accepted 2026-09-20
rejected:
  combined_diagram: concatenating diagram families is unreadable at any useful size
chosen:
  catalogs: requirement:project-catalogs for vocabulary, domains, tables, and DFDs
  analysis: requirement:element-analysis-view for one element across everything
  scope_views: c4_context at the root remains the widest drawn view
export:
  document_bundle: requirement:document-bundle-export generates a review document of all views and catalogs; it is an export, not an editor view
```

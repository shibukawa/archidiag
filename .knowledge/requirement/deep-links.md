---
id: requirement:deep-links
type: requirement
title: Deep Links and Embedding
---
Every view, element, dictionary entry, DFD, note, and finding must have a stable URL that opens the editor at that target, and views must be embeddable read-only in other pages.

```yaml
priority: v1
url_scheme:
  view: #/p/<project_id>/view/<view_id>
  select: ?select=<element_id>[,<id>]&mode=<name_mode>&perspective=<perspective_id>&filter=<value>
  entry: #/p/<project_id>/vocabulary/<entry_id>, /domain/<domain_id>, /table/<entity_id>
  analysis: #/p/<project_id>/analysis/<element_id>
  finding: #/p/<project_id>/findings/<item_id>?target=<id>
  embed: same URL with &embed=1 for a read-only canvas without chrome
resolution:
  - static build: project_id resolves to a local browser project or prompts to open a file
  - server: project_id resolves through data:project-store
  - unknown or deleted targets open the nearest parent and show a notice
uses:
  - bundle export, catalogs, analysis rows, MCP resources, and CLI output link with these URLs
  - copy link action on every selectable thing
acceptance:
  - opening a view link lands on that view with the selection and name mode applied
  - the browser back button walks navigation history
  - embed mode renders the saved layout, supports pan and zoom, and hides editing
  - links survive rename because they use ids
depends_on:
  - data:diagram-view
  - data:c4-project
  - data:project-store
  - requirement:document-bundle-export
  - requirement:project-catalogs
```

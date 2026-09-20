---
id: requirement:multiple-views-per-scope
type: requirement
title: Multiple Views per Scope
---
Authors must be able to keep several named views of the same kind for one scope, each showing a chosen subset of elements with its own layout, while navigation and DFD pairing stay stable through a default view.

```yaml
priority: v1
user_story: As an author, I keep a full Container View of the Commerce Platform and a second "Payments" view with only the payment-related containers for a review.
acceptance:
  - create, rename, duplicate, and delete views for the current scope and kind
  - switch views with tabs in the level navigator; the default view is marked and changeable
  - add or remove elements of the scope in a view without touching the model; a picker lists elements not yet shown
  - drill-down opens the target scope's default view; the last used view per scope is remembered in the session
  - relationships render between elements present in the view; hidden endpoints project per rule:nested-relationship-projection
  - each view has independent layout and boundary size
  - a check item reports elements that appear in no view of their scope
  - export uses the view name in the title
  - DFDs pair with the scope, not with one view (rule:dfd-c4-pairing)
depends_on:
  - data:diagram-view
  - data:c4-project
  - rule:hierarchical-navigation
  - rule:nested-relationship-projection
  - requirement:drag-layout-editing
  - ui:diagram-editor
```

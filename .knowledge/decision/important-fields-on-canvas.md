---
id: decision:important-fields-on-canvas
type: decision
title: Important Fields on Canvas
---
ERD cards draw only the attributes an author marks important, not every column and not a fixed first-N truncation, because a logical ERD communicates identity and meaning rather than the full column list.

```yaml
status: accepted 2026-09-21
chosen: explicit per-attribute important flag (requirement:erd-field-visibility)
rejected:
  all_attributes: cards with 30+ rows dominate the canvas and hide relationships
  first_n_rows: order-based truncation shows created_at before the business keys
  keys_only: too little; a Customer card without email or status says nothing
  per_view_selection: the subset belongs to the model, so every erd view and export shows the same rows
consequences:
  - data:attribute gains important; primary keys default to true
  - the inspector field list is the only place that shows every attribute
  - a check reports entities whose attributes are all hidden
  - the flag acts in fields display mode; descriptive mode shows the description instead (requirement:description-display)
```

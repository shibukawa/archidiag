---
id: requirement:erd-field-visibility
type: requirement
title: Important Fields on the ERD Canvas
---
Entity cards on erd_* diagrams must show only attributes marked important, so a table with many columns stays readable; the complete list lives in the inspector field list.

```yaml
priority: v1
user_story: As an author, I mark customer_id, email, and status as important on the 40-column Customer table; the card shows those three rows and the inspector still lists all 40.
important_flag:
  field: data:attribute important, boolean, default false
  relationships: data:entity-relationship important on references, default false; an important reference adds a chain row to the source card after the attribute rows
  defaults: a primary key attribute is created important; other attributes start not important
  edit: checkbox column in the field list; the flag is a model property, identical in every view
canvas:
  fields_mode: rows are the important attributes in field order with a key marker on primary keys (term:erd-notation)
  hidden_count: a footer row "… N more" when the entity has more attributes than shown
  none_important: the header plus the footer row only, so the card still says how many fields exist
  card_height: grows with the number of shown rows up to a bounded maximum; the footer counts the rest
  card_width: grows from the standard node width to fit the longest shown row or the entity name, up to a bounded maximum; C4 nodes keep the fixed width
inspector: the field list shows every attribute with an important-only filter
checks:
  - erd.entity_has_visible_attribute: an entity with attributes but none important, info by default (data:check-item)
export: erd exports render the same rows as the canvas; the document bundle and table catalog list every attribute (requirement:document-bundle-export)
acceptance:
  - toggling important on an attribute updates the card without moving nodes
  - a new entity's surrogate primary key is important by default
  - the flag round-trips through project JSON and api:ai-tool-surface
depends_on:
  - decision:important-fields-on-canvas
  - data:attribute
  - data:entity
  - term:erd-notation
  - requirement:description-display
  - ui:diagram-editor
```

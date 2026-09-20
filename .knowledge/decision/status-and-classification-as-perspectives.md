---
id: decision:status-and-classification-as-perspectives
type: decision
title: Status and Classification as Valued Perspectives
---
Element lifecycle status (existing, planned, deprecated) and data classification are built-in perspectives with enumerated values and style rules, so one annotation mechanism drives badges, colors, filters, propagation, and checks.

```yaml
status: accepted 2026-09-20
generalization:
  data:perspective gains value_kind free_text | enum, enum values, and per-value styles
  data:perspective-note gains value
built_in:
  lifecycle:
    values: existing | planned | deprecated
    targets: element, relationship, entity, entity_relationship, dfd_flow
    styles: planned dashed outline; deprecated gray fill and strike badge; existing default
    default: existing when no note
  data_classification:
    values: public | internal | confidential | pii
    targets: attribute, domain, entity, dfd_flow
    styles: pii red badge; confidential amber badge
    propagation: rule:classification-propagation
rejected:
  first_class_status_field: a second mechanism beside perspectives for the same badge, filter, and check needs
  tags: no values, no styles, no propagation; removed from the model entirely
consequences:
  - views can apply one perspective's styles and filter by its values (requirement:perspectives)
  - checks reference perspective values, for example lifecycle.no_existing_depends_on_planned
```

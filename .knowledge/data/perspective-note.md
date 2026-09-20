---
id: data:perspective-note
type: data
title: Perspective Note
---
A perspective note attaches one perspective's comment to one model target so cross-cutting concerns are recorded beside the elements they touch.

```yaml
fields: id, perspective_id, target_kind, target_id, value, text, author, created_at, updated_at
target_kind: element | relationship | entity_relationship | attribute | domain | vocabulary_entry | group | diagram | dfd_flow
value: required and one of the perspective's values when value_kind is enum; absent for free_text
constraints:
  - target_id resolves to a canonical record of target_kind
  - one target may hold many notes across perspectives and several notes of one perspective
  - deleting the target lists its notes before confirmation and removes them
  - notes are recorded in data:edit-operation history and attributed to the actor
rendering: badge icon on the target for each perspective with at least one note (requirement:perspectives)
```

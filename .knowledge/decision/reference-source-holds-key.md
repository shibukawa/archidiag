---
id: decision:reference-source-holds-key
type: decision
title: Reference Source Holds the Key
---
In a reference relationship the source entity is always the side that stores the foreign key and the target is the referenced entity, even for one-to-one references where cardinality alone cannot say which side holds it.

```yaml
status: accepted 2026-09-21
chosen: source = key holder, target = referenced entity (data:entity-relationship)
why:
  - cardinality decides nothing for 1 to 1 and 0..1 to 1 references, so the direction must carry the meaning
  - drawing from the many side toward the one side matches how authors think of a foreign key and how the link handle is dragged
  - physical projection can place the column without an extra flag (rule:domain-expansion)
rejected:
  key_holder_flag: a separate field that can disagree with the drawn direction
  infer_from_cardinality: undefined for symmetric multiplicities
consequences:
  - the inspector hint says the source is the many side that holds the key
  - the reference row on a card belongs to the source entity (term:erd-notation)
  - the AI tool surface documents sourceId as the key holder (api:ai-tool-surface)
```

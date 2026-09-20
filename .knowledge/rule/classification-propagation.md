---
id: rule:classification-propagation
type: rule
title: Data Classification Propagation
---
A classification set on an attribute or domain propagates upward to its entity and along DFD payloads to the flows, stores, and processes that carry it, using the highest value found.

```yaml
order: public < internal < confidential < pii
sources: data:perspective-note with the data_classification perspective on an attribute or a domain
derivation:
  attribute: explicit note, else the domain's note
  entity: highest of its attributes; an explicit entity note may raise but not lower it
  dfd_flow: highest of its data_refs entities, else explicit note
  data_store_node and process: highest of touching flows
display: derived values render as lighter badges than explicit ones and show their source on hover
checks (data:check-item):
  - classification.pii_flow_crosses_scope: a pii or confidential flow leaves the DFD scope or reaches an external entity
  - classification.pii_flow_through_queue: a pii flow passes intermediate data of kind queue
  - classification.pii_without_security_note: a pii entity or flow has no note in the security perspective
  - classification.pii_store_no_lifecycle: a pii entity without a retention note
constraints:
  - propagation is derived and never stored
  - lowering requires removing or changing the source note
```

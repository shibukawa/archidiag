---
id: decision:diagram-kind-extension
type: decision
title: Extend Diagrams by Kind, Not by Separate Projects
---
ERD and DFD are added as an entity element kind plus level-specific erd_* kinds and one dfd_container kind inside the existing project model instead of separate documents, so identity, validation, history, and export stay unified.

```yaml
chosen:
  diagram_kind: c4_context | c4_container | c4_component | erd_component | erd_code | dfd_container
  erd_kinds: erd_component (scope data store container) and erd_code (scope entity) are siblings of c4_component at the same zoom depth but carry entity content
  dfd_kinds: dfd_container only (decision:dfd-container-level-only); the kind alone fixes scope element kind and pairing; no separate level field
  c4_code: not introduced; code level exists only as erd_code
  new_element_kinds: entity
  new_records: data:entity-relationship, data:vocabulary-entry, data:data-domain, dfd nodes and flows
  storage: same data:c4-project file, schema_version bump
rejected:
  separate_erd_file: breaks rename propagation and DFD payload references
  erd_as_rendering_mode_of_c4_component: hides content differences behind the scope element kind; explicit erd_* kinds keep rendering, validation, and export branching readable
  dfd_as_annotated_c4_relationships: cannot express use cases, intermediate data, or multiple flows per pair
consequences:
  - rule:hierarchical-navigation maps data store containers to erd_component and entities to erd_code
  - kind and scope element kind must agree (rule:c4-model-integrity)
  - export and AI tools branch on diagram kind and scope element kind
  - migration keeps existing C4 projects valid
```

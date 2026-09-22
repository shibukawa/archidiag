---
id: rule:hierarchical-navigation
type: rule
title: Hierarchical Navigation and Shared Identity
---
Child diagrams are navigable views of canonical parent elements, so entering a child scope and renaming an element never creates a detached copy.

```yaml
navigation:
  target_view: the default data:diagram-view of the target scope and kind; a view switcher lists the others
  context_software_system: open container view with scope_id equal to the system id
  container_container: open component view with scope_id equal to the container id
  container_database_store: open erd_component with scope_id equal to the container id when data_store_kind is database or database_schema (rule:erd-scope-integrity)
  container_other_store: open the item list (erd_component kind) of a pubsub, queue, bucket, or file_share container showing its topics or folders (data:store-item)
  entity: open erd_code with scope_id equal to the entity id (data:entity)
  dfd_bound_node: open the element's own scope (rule:dfd-c4-pairing); there is no DFD-to-DFD drill-down (decision:dfd-container-level-only)
  dfd_diagram_ref: open the referenced DFD (data:dfd-diagram-ref)
  breadcrumb: show project root and ancestor names
  back: restore the previous diagram and selection when possible
identity:
  - diagram views store element refs, not duplicated element records
  - all labels resolve from the canonical element record
  - rename is one model operation and invalidates affected views
non_navigable:
  - people and external systems have no child scope by default
  - pubsub and other data stores have no child scope
  - entities without dependent entities open an empty erd_code view that invites adding one
```

---
id: decision:dfd-container-level-only
type: decision
title: DFDs at Container Level Only
---
A DFD lives only at container level, owned by a software system: its value is showing a use case from the user's action through UI, services, batches, queues, and stores, so a DFD inside one container adds little, and a sequence diagram would serve that need better if it were ever needed.

```yaml
status: accepted 2026-09-21
supersedes: decision:context-level-dfd
chosen:
  kind: dfd_container only; scope a software system; pairs with that system's c4_container views (rule:dfd-c4-pairing)
  processes: the system's components, or free nodes placed later as components (decision:dfd-first-free-nodes, decision:dfd-component-granularity)
  stores: tables of the system's databases; topics and folders as intermediate data
  external_entities: people, other systems, and anything outside the system
  inside_a_container: no DFD; decision:dfd-logical-process-group folds a UI -> handler -> batch chain into one logical process, and nested groups with collapse and expand give the DFD its own levels; component-level detail belongs to c4_component views
  across_systems: no DFD; cross-system flows appear as external entities of each system's DFDs, and data:dfd-diagram-ref links them
  zoom: double-click on a bound node opens the element's own C4 or ERD scope; double-click on a reference opens the target DFD; there is no DFD-to-DFD drill-down
  numbering: flat 1, 2, 3 per DFD; no inherited prefix
rejected:
  component_level_dfd: shows the same chain as the container DFD split by mechanical boundaries, without the user's action that gives it meaning
  context_level_dfd: too little detail to be authored; the cross-system view is the c4_context diagram plus references
  sequence_diagrams: would carry order and request/response inside a container, but that is rarely worth documenting; not planned
consequences:
  - term:diagram-family and decision:diagram-kind-extension list dfd_container as the only dfd kind
  - data:diagram-view of pre-release kinds dfd_context and dfd_component is dropped on import
  - data:check-item dfd.software_system_has_dfd stays; dfd.container_has_dfd is removed
  - rule:hierarchical-navigation dfd_process opens the element's scope, not a child DFD
```

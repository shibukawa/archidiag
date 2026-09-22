---
id: rule:dfd-c4-pairing
type: rule
title: DFD and C4 Pairing
---
Every DFD belongs to one software system and reads at component granularity: the system's components are the processes, its tables the stores, its topics and folders the intermediate data, and everything outside the system an external entity (decision:dfd-container-level-only, decision:dfd-component-granularity).

```yaml
kind_scope:
  dfd_container: scope software system; pairs with that system's c4_container views
roles_by_position:
  person: never a node; the start marker plus the UI process stand for the person (requirement:dfd-flow-direction)
  component_of_system_container: process (a screen, service, repository, or job of any application container of the system; the kind line names its container) (decision:dfd-drives-c4)
  passthrough_component: intermediate_data api_document bound to it, shown as "handled by"; a controller routes, it does not transform (decision:dfd-passthrough-components)
  entity: data_store when independent; a dependent (detail) entity binds its owner table instead (decision:dfd-component-granularity)
  passthrough_repository: never a node; the process touches its tables directly (decision:dfd-passthrough-components)
  topic: intermediate_data queue (data:store-item)
  folder: intermediate_data file (data:store-item)
  container: never a node; containers are deployment units and appear only as kind lines and in the derived C4 picture (decision:dfd-component-granularity)
  everything_else: external_entity (other systems and their components)
  free_node: role chosen at creation; placement makes it one of the above (decision:dfd-first-free-nodes)
zoom:
  bound_node: double-click opens the element's own scope (component view, ERD) exactly like the C4 canvas
  diagram_ref: double-click opens the target DFD
  up: breadcrumb returns to the system's Container view
  numbering: flat per DFD, assigned once, never reused
consistency:
  - a DFD flow between two bound nodes derives the C4 relationship between their elements; connected components make their containers connected (decision:dfd-drives-c4); a table, topic, or folder stands for its data store container
  - a stored relationship between two components can be imported into a DFD as a hop; relationships ending at a container, system, or store only offer candidates (requirement:c4-links-into-dfd)
  - deleting a C4 element turns its nodes into free nodes carrying the old name
views: a DFD pairs with the system, not with one data:diagram-view; the navigator shows the system's Container views and its DFDs together
side_by_side: the level navigator shows the Container view tabs and the DFD tabs for the current system; the explorer lists DFDs under their system
```

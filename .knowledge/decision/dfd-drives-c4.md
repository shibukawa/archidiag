---
id: decision:dfd-drives-c4
type: decision
title: DFD Flows Grow the C4 Model
---
A DFD is where structure is discovered: placing a component into a container (or into a placeholder "Unknown container") builds the C4 tree, C4 relationships between elements derive from DFD flows so that connected components make their containers connected too, and the other way round a stored 1:1 component link can be brought into a DFD as a hop (requirement:c4-links-into-dfd); either way there is one line per element pair with the individual flows and relationships listed inside.

```yaml
status: accepted 2026-09-21
chosen:
  processes: a DFD process is a free node or a component of any application container of the system (a screen, a handler, a job); the kind line names the component's container; containers themselves are never processes (decision:dfd-component-granularity)
  placement:
    component_into_container: placing a free process as a component asks for its container: an existing application container of the system, a new container (name and application kind), or the system's placeholder
    placeholder: one container per system named "Unknown container", flagged placeholder, created on demand when a component is placed without a container; dashed outline in C4 views; a check reports components still inside it; deleted automatically when empty
    registration_later: moving a component from the placeholder to a real container is the ordinary parent change; every derived relationship follows
  derived_relationships:
    source: every DFD flow between two bound nodes, or between two bound processes through one unbound intermediate data node, derives a C4 relationship between their elements; through a document handled by a passthrough component C the hop derives A -> C and C -> B (decision:dfd-passthrough-components); a flow touching a table, topic, or folder derives component -> that store container, whichever way the data moves (C4 relationships stop at the store, rule:erd-scope-integrity)
    projection: derived relationships obey rule:nested-relationship-projection like stored ones: connected components make their containers connected in the Container view and their systems connected in the Context view, promoted to the nearest visible ancestor
    external_elements: in a Component view, a derived relationship to a component of another container draws that component as external context, grouped under its container; a component of the placeholder draws under "Unknown container"
    label: the flow label; technology from the flow; description names the DFD and use case
    lifetime: derived, never stored; recomputed from the DFDs; deleting the flow removes the line
    materialize: the inspector can promote a derived relationship to a stored one when the author wants to edit or keep it independently of the DFD
  c4_to_dfd: a stored relationship between two components imports into a DFD as process -> api_document -> process with relationship_ref on the flows; relationships ending at a container, system, or store only offer candidates (requirement:c4-links-into-dfd)
  one_line_per_pair:
    rule: between the same two visible elements in the same direction there is exactly one drawn line, whether its members are stored relationships, derived flows, or both (rule:nested-relationship-projection merging); a flow carrying relationship_ref and its relationship count as one member
    inside: the inspector lists every member: stored relationships with their labels, derived flows with the DFD and use case they come from
    labels: the line shows the stored label when one exists, else the distinct flow labels stacked; technologies join with a slash
    dfd_side: the same rule holds on a DFD: several flows between the same two nodes in the same direction draw as one line and list inside
rejected:
  warn_and_offer: the earlier cross.dfd_flow_has_c4_relationship warning with a "create" button leaves the C4 model behind the DFD and duplicates lines once created
  one_line_per_flow: several parallel lines between the same pair hide the picture; the user asked for one line whose contents are inspectable
consequences:
  - rule:dfd-c4-pairing roles gain component_of_system_container: process
  - decision:dfd-first-free-nodes placement gains the container picker, new container, and placeholder options
  - data:c4-project containers gain a placeholder flag
  - data:check-item drops cross.dfd_flow_has_c4_relationship and gains c4.component_in_placeholder_container and c4.derived_relationship_not_materialized (info)
  - rule:nested-relationship-projection merging covers derived flows; requirement:use-case-dfd acceptance changes accordingly
```

---
id: data:dfd-process-group
type: data
title: DFD Process Group
---
A process group is the pseudo-component that gathers directly connected processes into one logical process, named and pictured by a representative member; nested groups give the DFD its levels (decision:dfd-logical-process-group).

```yaml
fields: id, dfd_id, name_override, member_ids, representative_node_id, process_number, description
member_ids: process nodes, groups, and the data:dfd-intermediate-data nodes between them, of the same DFD; at least two processes or groups; a member belongs to at most one group
representative_node_id: a member process, chosen by the ui > batch > upstream server order through nested groups; name_override replaces its name when set
process_number: the group's number at its level; members are numbered beneath it (1.1, 1.2) in flow order
collapsed: per data:diagram-view layout; collapsed draws the group as one process, expanded draws the members inside
render_expanded: rounded process box with the group number and name, members inside in flow order as process -> intermediate data -> process, internal flows kept as thin lines
render_collapsed: the representative's picture with the group number and name
flows: endpoints may be the group or a member; a flow to a member attaches to the box while the group is collapsed; a store end states operations once per group
constraints:
  - members are processes, groups, and the intermediate data joining them (including documents handled by passthrough components); stores, external entities, and references never join a group
  - internal flows between members are the reason the group exists and stay in data:dfd-model flows
  - removing members below two dissolves the group and returns the rest to the level above; the representative is re-chosen when members change
  - group nesting never cycles
```

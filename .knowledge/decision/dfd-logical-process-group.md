---
id: decision:dfd-logical-process-group
type: decision
title: Logical Process Group for Process Chains
---
Processes that hand data straight to each other form one logical process: the DFD groups them into a process group (a pseudo-component) that contains the member processes and speaks for them, because a UI calling a server handler that launches a batch is one instruction by the user whose final effect is the batch editing data; the split is mechanical, not logical. Nested groups are the DFD's own hierarchy: a collapsed group is one numbered process, an expanded one shows its members as sub-steps, in place of C4-level drill-down (decision:dfd-container-level-only).

```yaml
status: accepted 2026-09-21
chosen:
  group: data:dfd-process-group drawn as a process box containing its member processes and the intermediate data between them; flows from stores and external entities attach to the group or to a member
  trigger: connecting two processes with the link handle groups them and inserts data:dfd-intermediate-data between them, an API document by default, a file or a queue by choice; inside a group every hop is process -> intermediate data -> process, so the DFD keeps its rule at every level
  inner_rhythm: the nesting is process -> data -> process all the way down; what makes the group one logical process is that its intermediate data is transient (payloads, hand-over files, job queues), not a data store of the system
  representative: the member that gives the group its name, number, and picture, chosen in this order
    - ui: a component of a web_browser, mobile_app, or desktop_app container (a screen)
    - batch: a component of a worker container (a job)
    - otherwise: the most upstream member (the one with no incoming flow inside the group)
  reading: "<representative> edits <data>"; the handler and the batch in between are how, not who
  hierarchy: a group is the DFD's decomposition unit; groups nest, so a group may contain groups
  numbering: the group takes the next number at its level (1, 2); members are renumbered under it (1.1, 1.2, 1.1.1) in flow order; leaving a group returns a member to the level above
  collapse: per view, a group is collapsed (drawn as one process with the representative's picture, name, and number; flows to members attach to the box) or expanded (box containing members and their internal flows); export honors the state, so an overview and a detail picture come from one DFD
  merging: connecting a process to a member of a group adds it to the group; two groups connected merge, the representative is re-chosen
  zoom: double-click a collapsed group expands it; double-click an expanded group's title collapses it; double-click a member opens the member element's own C4 or ERD scope
rejected:
  bare_process_chains: a process-to-process flow without intermediate data hides what is handed over and breaks the notation; grouping alone would keep the hop invisible
  drop_the_chain: keeping only the representative loses the handler and batch, which the DFD must still show since there is no lower DFD level (decision:dfd-container-level-only)
consequences:
  - rule:dfd-connection-policy process_to_process resolves to group | file | queue instead of file | queue
  - term:dfd-notation gains node kind process_group; data:dfd-model gains process_groups
  - rule:dfd-connection-policy operations at a store end are stated once for the group, however many members touch the store
  - data:check-item dfd.atomic_boundary_* treat a group as one process
  - data:diagram-view layout stores which groups are collapsed
```

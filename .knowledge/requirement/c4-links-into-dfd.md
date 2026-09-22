---
id: requirement:c4-links-into-dfd
type: requirement
title: Bring 1:1 Component Links from C4 into a DFD
---
A stored C4 relationship whose two endpoints are both components (one to one) must be importable into a DFD as a flow, so a use case drawn after the structure can reuse the links already known, while relationships that stop at a container, system, or data store stay suggestions because they fan out to many components or tables.

```yaml
priority: v1
user_story: As an author, I drop Order Controller and Checkout Service onto "Place order"; the editor shows their C4 link "places orders and refunds via" and one click turns it into Order Controller -> request document -> Checkout Service.
importable:
  condition: relationship source and target are both components (kind component), either direction, possibly via a per-level endpoint mapping that resolves to two components
  result: one hop process -> data:dfd-intermediate-data api_document -> process; the document takes the relationship label as its name, the technology as format; the two processes join one logical process group (rule:dfd-connection-policy)
  passthrough_chain: A -> C -> B where C is a passthrough component imports as one hop A -> document handled by C -> B (decision:dfd-passthrough-components)
  origin: the two flows record relationship_ref = the relationship id (data:dfd-model)
not_importable:
  container_or_system_endpoint: a relationship ending at a container or system names no single component; the inspector lists the container's components as candidates and the author picks one, which creates the flow and records the mapping as the relationship's view_projection for the component level
  data_store_endpoint: a relationship ending at a database, pubsub, or bucket names no table, topic, or folder; the inspector lists the store's items as candidates
  person_endpoint: never a flow; a person is the start marker (requirement:dfd-flow-direction)
offers:
  on_drop: dropping a component onto a DFD lists its importable links to nodes already present; each is one click
  view_editor: the DFD inspector lists every importable link between present nodes that has no flow yet; import one or all
  quick_create: placing a free process onto a component that has importable links to present nodes makes the same offer
one_line:
  rule: a flow with relationship_ref and its relationship are one member of the drawn line in C4 views and one line on the DFD (decision:dfd-drives-c4 one_line_per_pair); importing never doubles a line
  divergence: editing the flow label does not rename the relationship; the inspector shows both texts on the line
  deletion: deleting the relationship keeps the flow, which then derives the line by itself; deleting the flow keeps the relationship
acceptance:
  - two component nodes with a stored 1:1 relationship show an import offer on drop and in the inspector; accepting creates the process -> API document -> process hop and groups the processes
  - a container-, system-, or store-ended relationship is never imported silently; candidates are offered and the pick is stored as the component-level endpoint mapping
  - an imported hop and its relationship draw as one line everywhere; relationship_ref survives export and import of the project
depends_on:
  - data:dfd-model
  - data:dfd-intermediate-data
  - rule:dfd-connection-policy
  - rule:nested-relationship-projection
  - decision:dfd-drives-c4
  - decision:dfd-component-granularity
  - ui:diagram-editor
```

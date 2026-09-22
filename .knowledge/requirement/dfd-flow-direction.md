---
id: requirement:dfd-flow-direction
type: requirement
title: DFD Reads Left to Right from a Start Marker
---
A DFD must read as one story from left to right: the use case starts at a start marker, the first process is the screen the user operates (screen and operator are one process, so C4 people never appear as nodes), every later node sits to the right of the flow that feeds it, and one "Arrange" action produces that picture from any tangle.

```yaml
priority: v1
user_story: As an author, I open "Place order", press Arrange, and read Start -> Checkout Page -> checkout request -> Order Service -> Orders DB left to right without a single arrow pointing back at me.
start_marker:
  node: role start, one per DFD, a small filled circle at the far left labelled with the use case; created with the DFD
  meaning: the user's action that begins the use case; it replaces the person node
  flows: only outgoing, to the first process (the UI screen or UI container the user operates)
people:
  rule: a data:c4-project person is never a DFD node; dropping one onto a DFD instead connects the start marker to the UI process the person uses (the container or screen its C4 relationship targets)
  reading: "<screen> (operated by <person>)" is one process; the inspector of a UI process shows which people use it, from C4
ui_process:
  bound_to: a screen component of a UI container (web_browser, mobile_app, desktop_app), for example Checkout Page (decision:dfd-component-granularity)
  representative: rule of decision:dfd-logical-process-group; a screen counts as ui
layout:
  direction: left to right by flow order from the start marker; a node's layer is one more than the deepest node feeding it
  responses: a response is implied by its request and is not drawn: "authorization request" to the payment provider says the result comes back; the confirmation to the screen is implied by the request that reached the service; round trips break the left-to-right reading and the layout
  return_flow_when: a flow back to an earlier node is drawn only when it starts a hand-off to a different service, that is when the answer itself becomes the input of another process; then it routes below the main lane as a return lane, drawn lighter
  request_response: when a pair in both directions between the same two nodes does exist, it is laid out as one forward hop and the check dfd.response_flow_drawn asks whether the answer is really needed
  stores: a table only read is a source of its reader and sits just left of it (never at the far left); a table written sits right of its writer; a table written then read sits between; layout is a topological sort of the forward flows, so a source is never right of its target unless a loop exists
  groups: an expanded data:dfd-process-group is laid out as a compound node; its members keep left-to-right order inside the box; a collapsed group is one node
  external_entities: an entity that only receives sits at the far right; one that answers a request (payment provider) sits above or below the process it answers, never left of it
arrange:
  action: the existing Arrange button (requirement:auto-layout); one undoable step; whole view or selection
  result: no forward flow points left; return lanes are the only leftward lines
acceptance:
  - a new DFD has a start marker; the explorer drop of a person creates or reuses the start-to-UI flow instead of a person node
  - after Arrange, every node is right of every node that feeds it, except through return lanes
  - a response paired with its request is reported by dfd.response_flow_drawn (info); the starter draws none
  - return lanes, when they exist, are drawn lighter and route below the main lane; they read as answers, not as steps backward
  - the starter's Place order reads Start -> Checkout Page -> checkout request (handled by Order Controller) -> Checkout Service -> Order Repository -> Orders tables, and on to the order-placed topic and the worker's job, left to right
  - layout.left_to_right_violations counts forward flows pointing left after Arrange, and is zero for the starter
depends_on:
  - term:dfd-notation
  - rule:dfd-c4-pairing
  - rule:edge-routing
  - requirement:auto-layout
  - decision:dfd-logical-process-group
  - ui:diagram-editor
```

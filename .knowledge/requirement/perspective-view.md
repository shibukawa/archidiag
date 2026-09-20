---
id: requirement:perspective-view
type: requirement
title: Perspective Dashboard View
---
Authors must be able to open one perspective, such as Security, as a dedicated view that gathers all its notes, derived values, affected elements, related checks, and a focus mode over any diagram, so cross-cutting concerns can be reviewed in one place instead of hunting badges.

```yaml
priority: v1
user_story: As a security reviewer, I open the Security perspective and see every note across systems, containers, tables, and flows grouped by scope, the PII flows that cross boundaries, and the open security findings, then jump into any diagram with only those items highlighted.
sections:
  summary: note count by target kind, value distribution for enum perspectives, open findings count
  notes: table of notes with target, scope path, value, text, author, date; grouped by scope or by value; inline edit
  derived: for valued perspectives, derived values such as rule:classification-propagation results with their sources
  findings: check findings whose item references this perspective (for example classification.* or perspective.required_on_kind)
  coverage: elements of a chosen kind without a note, to spot gaps
  focus: open any view with this perspective's filter and styling active (requirement:perspectives)
acceptance:
  - open from the explorer's perspectives section or from any badge's callout
  - badges on the canvas show a callout on hover with the note text and a link to this view
  - filters by scope, kind, value, author, and date; search in note text
  - add a note to a target from the coverage list without leaving the view
  - export the view as a Markdown section; the document bundle includes it per perspective
  - deep link to the view and to a filtered state (requirement:deep-links)
depends_on:
  - data:perspective
  - data:perspective-note
  - requirement:perspectives
  - rule:classification-propagation
  - rule:check-evaluation
  - requirement:deep-links
  - requirement:document-bundle-export
  - ui:diagram-editor
```

---
id: requirement:perspectives
type: requirement
title: Cross-Cutting Perspectives
---
Authors must be able to define perspectives and attach comments under them to any model target, see a badge on annotated targets, and filter or list the model by perspective.

```yaml
priority: v1
user_story: As an author, I define a "Security" perspective and add a note to every container that handles personal data; each shows a shield badge and I can highlight only those.
acceptance:
  - create, rename, describe, and color a perspective with an icon from a fixed set
  - add, edit, and delete notes on elements, relationships, entities, groups, diagrams, and DFD flows from the inspector
  - a target with notes shows one badge per perspective; hover shows the note count
  - a perspective filter dims every target without a note of the selected perspective, or without a chosen value, on the current diagram
  - activating a perspective's styling on a view recolors and restyles targets by value, in canvas and exports
  - enum perspectives edit as a picker; built-in lifecycle and data_classification are available in every project
  - a perspective dashboard gathers all notes, derived values, coverage, and findings of one perspective (requirement:perspective-view)
  - badges appear in PDF, draw.io, PNG, and SVG export; an optional appendix lists the notes
  - perspectives and notes round-trip through project JSON
  - AI tools can list perspectives and add notes directly with agent attribution (rule:ai-change-consent)
depends_on:
  - data:perspective
  - data:perspective-note
  - decision:status-and-classification-as-perspectives
  - data:c4-project
  - data:edit-operation
  - api:ai-tool-surface
  - ui:diagram-editor
```

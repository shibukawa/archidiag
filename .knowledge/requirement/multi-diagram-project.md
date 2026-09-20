---
id: requirement:multi-diagram-project
type: requirement
title: One Model, Multiple Diagram Families
---
The project must hold C4, ERD, and DFD views, vocabulary, and domains over one canonical element set with shared navigation, validation, history, export, collaboration, and AI tooling.

```yaml
priority: v1
acceptance:
  - every diagram record carries a kind from term:diagram-family
  - the level navigator switches among c4_*, erd_*, and paired dfd_* diagrams for the current scope
  - undo and redo cover entity, attribute, vocabulary, domain, and DFD edits through the same command history
  - validation aggregates C4, ERD, vocabulary, domain, and DFD issues in one panel with navigation to the source
  - project JSON schema_version is bumped and older files import with empty vocabulary, domain, entity, and DFD sets
  - the AI tool surface exposes read and mutation tools for entities, attributes, vocabulary, domains, and DFDs
  - collaboration operations cover the new records without a separate protocol
depends_on:
  - term:diagram-family
  - data:c4-project
  - data:entity
  - data:dfd-model
  - decision:diagram-kind-extension
  - decision:no-logical-physical-split
  - requirement:vocabulary-dictionary
  - requirement:domain-dictionary
  - requirement:project-portability
  - requirement:validation-and-export
  - requirement:ai-assisted-editing
  - api:ai-tool-surface
```

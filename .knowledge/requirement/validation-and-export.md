---
id: requirement:validation-and-export
type: requirement
title: Validation and Diagram Export
---
The editor must validate model integrity continuously enough to prevent invalid saves and export readable diagrams or source data.

```yaml
priority: mvp
acceptance:
  - identify missing names, duplicate ids, broken endpoints, and invalid scope
  - flag a data store container without a data store kind
  - distinguish blocking errors from warnings
  - allow navigation from a validation issue to its element
  - export a rendered diagram image or document
  - export the portable JSON project independently of rendering
depends_on:
  - rule:c4-model-integrity
  - data:c4-project
```

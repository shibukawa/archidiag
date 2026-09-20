---
id: requirement:data-classification
type: requirement
title: Attribute-Level Data Classification
---
Authors must be able to classify attributes and domains (public, internal, confidential, PII) and see the classification propagate to tables, DFD flows, stores, and processes with badges, filters, and checks.

```yaml
priority: v1
user_story: As an author, I mark the Email domain as PII; every column using it, the User table, and the "Place order" flow that carries User show a PII badge, and a check flags that the flow reaches the Payment Provider.
acceptance:
  - set a classification on an attribute or domain from the field list or dictionary
  - derived badges appear on entities, DFD flows, stores, and processes with source on hover
  - filter a DFD or ERD view to classified items only; apply classification styles to a view
  - the table catalog and element analysis show classification columns
  - checks from rule:classification-propagation appear in the validation panel at the active profile's levels
  - the document bundle includes a classification appendix listing PII tables and the flows that carry them
  - the AI tool surface can set and query classifications
depends_on:
  - decision:status-and-classification-as-perspectives
  - rule:classification-propagation
  - data:perspective
  - data:perspective-note
  - data:attribute
  - data:data-domain
  - data:dfd-model
  - requirement:perspectives
  - requirement:configurable-model-checks
```

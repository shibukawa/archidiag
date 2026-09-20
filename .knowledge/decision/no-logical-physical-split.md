---
id: decision:no-logical-physical-split
type: decision
title: No Logical/Physical Split
---
ERD and DFD follow the C4 stance: one model holds logical meaning and physical choices together, and abstraction changes by zooming between levels, not by maintaining separate logical and physical diagrams.

```yaml
chosen:
  entity_record: business meaning, vocabulary names, domain, and physical column projection live in one data:attribute
  technology: data store technology, physical names, and types may be filled at any time, including first sketch
  abstraction: term:c4-diagram-level levels replace logical-vs-physical diagram pairs
  dfd: one DFD per use case per level; a process at level N zooms into a DFD at level N+1 (rule:dfd-c4-pairing)
rejected:
  separate_logical_and_physical_erd: duplicates identity and drifts
  dfd_detached_from_c4_elements: loses zoom and rename propagation
consequences:
  - unresolved physical details are valid states, reported only by export readiness checks
  - name display switches among business, system, and physical forms (requirement:name-display-switching)
  - data:data-domain is the single authority for a column's type at every level
```

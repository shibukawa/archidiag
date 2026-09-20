---
id: data:element-usage
type: data
title: Element Usage
---
Element usage is a derived, read-only projection that gathers everything the project knows about one element across every view, DFD, dictionary, and annotation.

```yaml
input: one canonical element (person, system, container, component, entity) or one data:data-domain or data:vocabulary-entry
sections:
  identity: kind, scope path, group, classification, technology, sql_dialect, names in all three modes
  views: data:diagram-view records that show the element, grouped by kind
  relationships: C4 relationships in both directions with the counterpart, label, technology, and the views where each is visible
  dfd_roles: every DFD the element appears in, with role, process number, and use case
  data_access:
    for_process: entities and data stores it reads or writes, with the union of operations and the DFDs contributing
    for_entity_or_store: processes that read or write it, with operations, transaction boundaries, and DFDs
  erd: attributes, domains, entity relationships, dependent entities, referencing entities
  dictionary: vocabulary entries and domains it uses, terms mentioned in its text, and for a domain or entry, the elements binding or mentioning it
  annotations: perspective notes grouped by perspective
  findings: check findings targeting the element
computation: pure over data:c4-project; recomputed on change; never stored
navigation: every row links to its view, DFD, dictionary entry, or note
```

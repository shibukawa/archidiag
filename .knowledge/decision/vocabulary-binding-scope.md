---
id: decision:vocabulary-binding-scope
type: decision
title: Vocabulary Binding Scope
---
Vocabulary binding is required for entities, attributes, and domains, and optional for C4 elements, whose names and descriptions instead get passive term links when they contain registered vocabulary.

```yaml
status: accepted 2026-09-20
required_binding: data:entity, data:attribute, data:data-domain
optional_binding: person, software_system, external_system, container, component, group, perspective
passive_links:
  where: element names, descriptions, relationship labels, DFD flow labels, perspective notes
  behavior: registered terms render as links in inspector and analysis text; hover shows business, system, and physical names; click opens the entry
  matching: rule:vocabulary-resolution over the text, read-only, cached, never mutates the element
  indicators: none; unregistered words in C4 text are not findings
  usage: passive matches appear in data:vocabulary-entry usage as "mentions", separate from bindings
rejected:
  required_binding_for_all_elements: adds check noise for names that are not data terms
consequences:
  - requirement:name-display-switching applies to C4 elements only when they opt into binding
  - check items vocabulary.* target bound owners only
```

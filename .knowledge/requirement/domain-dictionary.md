---
id: requirement:domain-dictionary
type: requirement
title: Project Domain Dictionary
---
Authors must be able to consolidate the domains that fields create automatically, define them as primitive, composite, or code set types, and pre-register shared domains, so column types stay consistent across the project.

```yaml
priority: v1
user_story: As an author, I sketch tables typing user_code in four of them, later open the dictionary, merge the four automatic domains into one UserCode, define it as varchar(6), and every column updates.
acceptance:
  - creating a field creates or reuses a same-named domain (decision:field-first-domains); the dictionary leads with merge candidates and uncurated domains
  - quick entry of a domain name with Enter pre-registers a shared domain and keeps the input ready
  - a dictionary panel shows flat categories, domains with origin and curated markers, and the selected domain's definition side by side
  - define single_field with primitive type and parameters, multi_field with ordered components, or code_set with entries
  - override a field's automatic domain by drag or picker; undefined and composite domains are assignable
  - domain definition is authoritative over any independently entered type
  - a composite domain stays one attribute row and expands through rule:domain-expansion on export
  - an attribute may use the domain name as a name suffix (use_domain_name)
  - search by domain, component, primitive type, and category name
  - domains and categories round-trip through project JSON
depends_on:
  - decision:field-first-domains
  - flow:domain-lifecycle
  - requirement:domain-consolidation
  - data:data-domain
  - data:domain-component
  - data:primitive-type
  - data:code-set
  - rule:domain-expansion
  - data:attribute
  - requirement:vocabulary-dictionary
  - ui:diagram-editor
```

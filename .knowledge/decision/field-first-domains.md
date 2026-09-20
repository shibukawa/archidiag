---
id: decision:field-first-domains
type: decision
title: Field-First Domains
---
Domains are born from fields, not defined ahead of them: every new field gets a same-named domain automatically, and the dictionary is where those domains are later consolidated, typed, and named for the whole project.

```yaml
status: accepted 2026-09-20
supersedes: domain-first capture, where authors registered domains in the dictionary and then assigned them to fields
why:
  - sketching tables must not stop to think about types; a field name is enough to start
  - consistency is reached by merging later, when duplicates are visible across tables
  - every column has a domain from the first keystroke, so type authority never has a gap
flow: flow:domain-lifecycle
kept_from_domain_first:
  - direct domain entry in the dictionary for shared domains known up front, such as CreatedAt or Money
  - drag or pick a domain onto a field to override the automatic one
  - domain definition remains the single type authority (data:data-domain)
consequences:
  - data:data-domain records their origin and whether they were curated
  - the check ladder replaces "domains assigned" with "domains consolidated" (data:check-profile)
  - the dictionary panel leads with merge candidates rather than with an empty entry box
```

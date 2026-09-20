---
id: data:starter-project
type: data
title: Starter Project
---
A starter project is a built-in, complete, valid data:c4-project that demonstrates every diagram kind, dictionary, group, perspective, and DFD feature and doubles as a regression fixture.

```yaml
fields: id, name, summary, locale_names, project
built_in:
  commerce_platform:
    systems: Commerce Platform, Payment Provider (external), Customer (person)
    containers: Web Application, Order Service, Order Worker, Orders DB (postgresql), Product Catalog DB (sqlite), Order Events (pubsub)
    erd: Orders DB with User -> Affiliation, Belonging; Order -> OrderLine as dependent tables; natural key user_code
    dfds: Place order at dfd_context, dfd_container, dfd_component with a queue and an atomic transaction boundary
    dictionaries: Japanese business names with English system and physical names; curated domains UserId, UserCode, Money, CreatedAt plus a few uncurated automatic domains left to demonstrate consolidation
    groups: Order Domain, Catalog Domain
    perspectives: Security notes on external-facing containers
    views: a second "Payments" container view
  blank: empty project with the built-in check ladder and primitive domains
constraints:
  - starter projects load without a server on system:github-pages-host
  - every starter passes rule:c4-model-integrity and the export_ready profile with only info findings
  - starters are shipped as JSON fixtures inside the build and versioned with the schema
```

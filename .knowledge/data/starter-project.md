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
    dfds: Place order as the Commerce Platform's dfd_container at component granularity (decision:dfd-component-granularity): Checkout Page, the checkout request document handled by Order Controller, Checkout Service writing the Order and Payment tables directly (Order Repository implied, Order Line a dependent detail of Order carried as a payload; decision:dfd-passthrough-components, decision:dfd-component-granularity), the order-placed topic of Order Events, and the worker's job form one logical process group; no response flows are drawn (requirement:dfd-flow-direction); an atomic and an eventual transaction boundary
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

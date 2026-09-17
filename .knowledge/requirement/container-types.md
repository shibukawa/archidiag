---
id: requirement:container-types
type: requirement
title: Classify Application and Data Store Containers
---
The editor must distinguish application containers from data store containers and preserve the selected data store kind in every view and export.

```yaml
priority: mvp
taxonomy:
  application: executable applications, services, or user interfaces
  data_store:
    database: persistent database technology
    database_schema: logical schema or bounded data model
    pubsub: publish-subscribe topic, broker, or messaging store
    other: another persistent or messaging data store
acceptance:
  - create an application container
  - create a data store container
  - select database, database schema, Pub/Sub, or other
  - show the taxonomy in the canvas node and inspector
  - preserve taxonomy through JSON, draw.io, PDF, PNG, and SVG export
  - treat a legacy generic container as an application container
depends_on:
  - data:c4-project
  - requirement:three-c4-layers
  - ui:diagram-editor
```

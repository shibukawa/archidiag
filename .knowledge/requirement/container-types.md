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
    kinds: web_browser | mobile_app | desktop_app | server | worker | other; drawn with the C4 reference pictures (browser window, phone, window, terminal prompt, gear)
  data_store:
    database: persistent database technology
    database_schema: logical schema or bounded data model
    pubsub: publish-subscribe topic or broker
    queue: point-to-point message queue
    bucket: object storage bucket
    cache: in-memory or distributed cache
    file_share: file system or network share
    other: another persistent or messaging data store
acceptance:
  - create an application container
  - create a data store container
  - select the category and the data store kind with radio buttons so every option is visible in one tap
  - select the SQL dialect (postgresql, sqlite, mysql) for database and database schema containers
  - show the taxonomy in the canvas node and inspector
  - preserve taxonomy through JSON, draw.io, PDF, PNG, and SVG export
  - treat a legacy generic container as an application container
depends_on:
  - data:c4-project
  - requirement:three-c4-layers
  - ui:diagram-editor
```

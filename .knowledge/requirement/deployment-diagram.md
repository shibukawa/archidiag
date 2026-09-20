---
id: requirement:deployment-diagram
type: requirement
title: Deployment Diagram
---
The editor should let authors map container instances onto a tree of deployment nodes per environment so infrastructure and physical technology choices live in the same model.

```yaml
priority: v2
kind: deploy_container
scope: one environment (for example production, staging)
model:
  deployment_node: id, environment_id, parent_node_id, name, technology, instances
  container_instance: id, node_id, container_ref, replicas
  infrastructure_node: id, node_id, name, technology (load balancer, DNS, managed service)
acceptance:
  - create environments and nested deployment nodes
  - place a canonical container as an instance on a node; labels resolve from the container
  - relationships between placed instances derive from container relationships
  - export with the other diagram kinds
depends_on:
  - decision:c4-supplementary-diagrams
  - data:c4-project
  - term:diagram-family
```

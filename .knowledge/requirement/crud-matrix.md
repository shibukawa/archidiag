---
id: requirement:crud-matrix
type: requirement
title: CRUD Matrix from DFD Operations
---
The editor should derive a process-by-entity CRUD matrix from DFD flow operations so authors can review data ownership and coverage without a separate model.

```yaml
priority: v2
acceptance:
  - rows are processes (containers or components), columns are entities or data stores
  - cells are the union of operations on flows in every DFD of the project
  - click a cell to list the DFDs and flows that contribute
  - highlight entities with no creator or no reader
  - the per-element slice of the matrix is the data_access section of data:element-usage
depends_on:
  - data:dfd-model
  - rule:dfd-connection-policy
  - data:entity
```

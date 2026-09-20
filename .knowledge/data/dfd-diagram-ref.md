---
id: data:dfd-diagram-ref
type: data
title: DFD Diagram Reference
---
A diagram reference is an off-page connector node that links a flow to another DFD, letting large use cases be split across diagrams.

```yaml
fields: id, target_dfd_id, target_node_id, label
render: off-page connector shape with the target DFD name and level
navigation: double-click opens the target DFD and selects target_node_id when set
reverse_link: the target DFD lists incoming references in its inspector
constraints:
  - target_dfd_id resolves; deleting the target lists referencing DFDs before confirmation
  - a reference may point across levels and use cases
  - flows attach to the reference as if to the target node's role
```

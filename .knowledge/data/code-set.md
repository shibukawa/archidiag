---
id: data:code-set
type: data
title: Code Set
---
A code set is a reusable ordered named-value list backed by one scalar primitive type; it is not a database-native enum.

```yaml
fields: base_type, entries
base_type: varchar | integer | decimal
entry: name, value, description
constraints:
  - entry values conform to base_type
  - entry order is explicit and user-controlled
  - physical projection emits base_type, never a native enum
```

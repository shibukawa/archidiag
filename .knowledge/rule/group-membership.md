---
id: rule:group-membership
type: rule
title: Group Membership
---
An element belongs to at most one group, that group lives in the element's own scope, and moving or deleting groups never moves or deletes elements.

```yaml
membership:
  - element.group_id is optional and refers to one data:group
  - group.scope_id equals element.parent_id (or project root for root elements)
  - an element changes group by drag on the canvas or tree; layout follows the group boundary
nesting:
  - parent_group_id stays within the same scope_id
  - the group tree has no cycles
deletion:
  - deleting a group clears group_id of its members and reparents child groups to its parent
  - deleting a scope element deletes its groups with it
rendering:
  - a group boundary encloses its members and nested groups; it auto-expands like the scope boundary (rule:external-context-boundary)
  - group boundaries never enclose external context
```

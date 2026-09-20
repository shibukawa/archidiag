---
id: data:check-profile
type: data
title: Check Profile
---
A check profile is a named progress step that assigns a level to every check item, optionally extending an earlier profile, and profiles form an ordered ladder.

```yaml
fields: id, name, description, order, extends, item_levels, builtin
item_levels: map of data:check-item id -> error | warning | info | off; unspecified items inherit from extends, then default_level
builtin_ladder:
  - context_sketch: systems and people named; everything else off
  - container_sketch: containers exist with technology; relationships labeled
  - component_complete: application containers have component diagrams; elements described
  - erd_business_names: data stores have entities with attributes in business names
  - domains_consolidated: no duplicate domain candidates; single-use and uncurated domains reviewed (decision:field-first-domains)
  - domains_typed: every domain has a primitive type or typed components
  - system_names: every vocabulary entry used has a system name
  - physical_names: physical names present; no unmatched segments; no column conflicts
  - dfd_coverage: every software system and container has at least one DFD; store flows carry operations
  - export_ready: all previous steps as errors; lossy dialect mappings stay info
customization:
  - rename, reorder, add, remove, and duplicate profiles
  - set any item level in any profile; extend another profile to inherit
  - import and export the ladder as versioned JSON to share across projects
constraints:
  - extends never cycles
  - a project has one active profile; ladder order is independent of the active choice
```

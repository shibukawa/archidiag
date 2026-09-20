---
id: data:check-item
type: data
title: Check Item
---
A check item is one deterministic completeness rule with a family, a target kind, parameters, and a default level that profiles may override.

```yaml
fields: id, family, target_kind, title, description, default_level, parameters, builtin
family: c4 | erd | dfd | vocabulary | domain | perspective | cross
target_kind: element | relationship | diagram | entity | attribute | entity_relationship | domain | vocabulary_entry | dfd_flow | project
level: error | warning | info | off
builtin_examples:
  c4:
    - c4.element_has_description
    - c4.container_has_technology
    - c4.software_system_has_container_diagram
    - c4.application_container_has_component_diagram
    - c4.relationship_has_label
    - c4.relationship_has_technology
    - c4.element_in_group
    - c4.element_in_some_view
    - layout.left_to_right_violations: dfd_* views only
  erd:
    - erd.data_store_has_entities
    - erd.entity_has_attributes
    - erd.entity_has_primary_key
    - erd.entity_has_surrogate_or_natural_key
    - erd.key_suffix_matches_key_kind: _id only on surrogate, _code only on natural
    - erd.entity_has_classification
    - erd.attribute_has_domain: normally always true under decision:field-first-domains; catches explicit unassignment
    - erd.attribute_has_description
    - erd.entity_referenced_by_relationship
  domain:
    - domain.has_type
    - domain.composite_components_typed
    - domain.no_column_name_conflict
    - domain.lossy_dialect_mapping: info by default; canonical type not preserved by the data store's dialect
    - domain.dialect_selected: data store has an sql_dialect
    - domain.single_use
    - domain.duplicate_candidates
    - domain.uncurated
  vocabulary:
    - vocabulary.no_unmatched_segments
    - vocabulary.no_alias_usage
    - vocabulary.has_system_name
    - vocabulary.has_physical_name
    - vocabulary.physical_name_matches_policy
    - vocabulary.plural_missing
  dfd:
    - dfd.software_system_has_dfd
    - dfd.container_has_dfd
    - dfd.flow_has_payload_or_label
    - dfd.store_flow_has_operations
    - dfd.atomic_boundary_single_store
    - dfd.atomic_boundary_no_queue
    - dfd.diagram_ref_resolves
  perspective:
    - perspective.required_on_kind: parameters perspective_id, element_kinds
  lifecycle:
    - lifecycle.existing_depends_on_planned
    - lifecycle.deprecated_still_written
    - lifecycle.planned_without_description
  classification: rule:classification-propagation items
  cross:
    - cross.dfd_flow_has_c4_relationship
    - cross.entity_has_creator_and_reader
constraints:
  - evaluation is deterministic and pure over data:c4-project
  - user-defined items are parameterized instances of built-in templates, never scripts
  - integrity rules from rule:c4-model-integrity are not check items and cannot be turned off
```

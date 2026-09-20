---
id: rule:physical-naming-policy
type: rule
title: Physical Naming Policy
---
A project selects one naming policy that governs how physical names are suggested and validated; physical names themselves stay explicit values on vocabulary entries and are never rewritten by the policy.

```yaml
scope: one policy per project, stored in data:c4-project; per-entry physical_name always wins
options:
  transliteration: translate | romaji_hepburn | romaji_kunrei
  languages: business_language and system_language from requirement:ui-localization; translate maps business to system language, romaji is available only for ja
  identifier_case: snake_case | camelCase | PascalCase
  table_number: singular | plural
  primary_key_column: entity_id (default) | id
  key_suffixes:
    surrogate: _id
    natural: _code
  foreign_key_column: relationship_name_key | referenced_entity_key
  reserved_words: reject | suffix_underscore
  max_identifier_length: from the data store's data:sql-dialect-mapping
defaults: translate to en, snake_case, singular, entity_id, referenced_entity_key, reject
key_semantics:
  surrogate: system-generated identity with no business meaning; column named <entity>_id; the default primary key
  natural: business identifier such as a customer code; column named <entity>_code; unique, may be the primary key when no surrogate exists
  both: an entity may hold a surrogate primary key and a natural unique key side by side
  foreign_key: references the target's primary key, so it normally ends with _id; a reference to a natural key ends with _code
plural:
  - never derived by algorithm; a plural policy requires physical_name_plural on each data:vocabulary-entry used as a table name
  - a missing plural is a check finding, not a guess
transliteration:
  translate: suggestion providers translate business names from business_language to system_language (requirement:name-suggestion)
  romaji: deterministic transliteration table for ja; long vowels and particles follow the selected style; no AI needed
  other_transliterators: per-language plugins may be added later behind the same option
application:
  suggest: data:name-suggestion candidates are generated in the policy's style
  validate: check items vocabulary.physical_name_matches_policy, vocabulary.plural_missing, erd.key_suffix_matches_key_kind, erd.entity_has_surrogate_or_natural_key
  generate: data:vocabulary-binding physical derivation joins segment physical names with the policy's case rule
constraints:
  - changing the policy never changes stored physical names; it changes findings and future suggestions
  - a project may whitelist entries that intentionally deviate
```

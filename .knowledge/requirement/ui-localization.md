---
id: requirement:ui-localization
type: requirement
title: UI Localization and Language Separation
---
The editor must localize its interface independently of the languages used for business names and system names, because teams commonly analyze and design in their own language while the system is named in English.

```yaml
priority: v1
languages:
  ui_locale: en, ja at launch; string catalog extensible per locale
  business_language: project setting; the language of vocabulary business names and descriptions (any)
  system_language: project setting; default en; the language of system and physical names
  independence: any combination; a Japanese UI over Japanese business names and English system names is the reference case
scope:
  - every UI string, menu, dialog, validation message, check item title, and export title block
  - locale-aware sorting and search for catalogs and vocabulary
  - number and date formatting in bundle exports
  - built-in starter projects carry names in both business and system languages (data:starter-project)
acceptance:
  - switch UI locale at runtime without reload; choice is remembered per browser
  - model data never changes with the UI locale; only chrome and generated text
  - check findings and CLI output are available in the UI locale or in English with --lang
  - the document bundle picks a locale for headings independently of the name mode
  - adding a locale is a string catalog change with no code changes
  - name suggestion translates from business_language to system_language; romaji applies only when business_language is ja (rule:physical-naming-policy)
depends_on:
  - data:c4-project
  - requirement:vocabulary-dictionary
  - requirement:name-display-switching
  - requirement:name-suggestion
  - requirement:document-bundle-export
  - requirement:headless-cli
  - ui:diagram-editor
```

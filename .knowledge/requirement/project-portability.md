---
id: requirement:project-portability
type: requirement
title: Portable Project Files
---
The editor must let users export and import a versioned project file so work is not trapped in local browser storage.

```yaml
priority: mvp
acceptance:
  - export data:c4-project as a versioned JSON file, or as a YAML folder archive (decision:yaml-on-disk-json-in-browser)
  - import valid files with a preview of project metadata
  - reject invalid files with actionable messages
  - preserve stable ids, relationships, and layout through round trip
  - preserve container categories and data store kinds through round trip
  - document compatibility behavior for future schema versions
depends_on:
  - data:c4-project
  - rule:c4-model-integrity
```

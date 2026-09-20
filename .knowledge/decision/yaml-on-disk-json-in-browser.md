---
id: decision:yaml-on-disk-json-in-browser
type: decision
title: YAML on Disk, JSON in Browser
---
A project stored in a folder is a tree of small YAML files, one record per file, while the browser works on an in-memory JSON model and the single-file portable export stays JSON; both forms convert losslessly.

```yaml
status: accepted 2026-09-20
on_disk:
  format: YAML, one file per record, stable ids as file names, stable key order
  layout: data:project-store
  why: readable diffs, conflict locality per element, hand-editable, comments allowed
in_browser:
  format: the data:c4-project JSON model in memory and in local browser persistence
  why: no parser cost on the hot path, direct use by exporters and tools
portable_file:
  format: single JSON file (requirement:project-portability) for import, export, and attachments
  yaml_folder_archive: a zipped YAML folder is also importable
conversion:
  - YAML folder <-> JSON model is a pure function in decision:shared-typescript-core with round-trip tests on every starter
  - unknown keys survive round trips so hand-written extras are not lost
  - the CLI (requirement:headless-cli) converts in both directions
journal: append-only JSON lines because it is a log, not the model
rejected:
  single_yaml_file: merge conflicts on every edit
  json_on_disk: noisy diffs and no comments
```

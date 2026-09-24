---
id: data:project-store
type: data
title: Project Store
---
The project store is the on-disk directory layout that keeps each project as a tree of YAML record files plus a change journal and the CRDT state, used by the server and the CLI.

```yaml
root: configured project root directory
layout (decision:yaml-on-disk-json-in-browser):
  c4sketch.yaml: project metadata, schema_version, naming policy, active check profile, style theme, settings
  elements/<id>.yaml: one canonical element per file, including entities with attributes
  relationships/<id>.yaml, entity-relationships/<id>.yaml
  views/<id>.yaml: data:diagram-view including layout and dfd payload
  vocabulary/<id>.yaml, domains/<id>.yaml, groups/<id>.yaml
  perspectives/<id>.yaml, perspective-notes/<id>.yaml
  checks/profiles/<id>.yaml, checks/items/<id>.yaml
  reviews/<id>.yaml: data:review-thread, outside the model
  .journal/journal.jsonl: attributed change entries (revision, actor, changed records), append-only
  .crdt/state.bin: the Yjs document state (decision:crdt-collaboration), so replicas merge into one history
  .gitignore: .lock and .crdt/
  exports/: generated diagram files, DDL, and document bundles on demand
revision: monotonically increasing per project; the gateway and MCP clients address operations by it
recovery: load .crdt/state.bin, then apply YAML changed on disk since as an edit by "Files on disk"; without state, load the YAML tree
compatibility: the YAML tree converts losslessly to the portable JSON file of requirement:project-portability
constraints:
  - writes are serialized per project by the single holder of the folder lock
  - .lock: at the served folder root, written by a running server with pid, start time, and host; a second writer refuses to start; read-only CLI commands ignore the lock
  - a stale lock (dead pid) is reported and can be cleared explicitly
  - journal entries are immutable; corrections are new operations
  - git-friendly formatting: stable key order, one record per file, comments preserved
  - a folder without the journal is still a complete project; the journal is history only
```

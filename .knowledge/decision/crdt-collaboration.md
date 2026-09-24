---
id: decision:crdt-collaboration
type: decision
title: CRDT Collaboration With a Server Hub
---
Shared editing synchronizes the project as a Yjs CRDT document through system:bun-server, which is the single relay, persistence point, and attribution authority; concurrent edits merge instead of being ordered and rejected.

```yaml
status: accepted 2026-09-24
supersedes: operation ordering, base_revision rebase, and optimistic rollback in decision:server-authority-when-present
document:
  mapping: data:c4-project JSON as nested Y.Map; records, fields, and layout positions merge key by key
  keyed_arrays: attributes, domain components, code set entries are Y.Array items by id, so concurrent inserts both survive
  other_arrays_and_scalars: last writer wins
  delete_vs_edit: a deleted record stays deleted
  core: src/core/crdt.ts in decision:shared-typescript-core, used by browser and server
server:
  role: hub; browsers sync only through it (no tab-to-tab channel), so read_only is enforced by dropping that connection's updates
  attribution: every accepted transaction gets the next revision; entries per actor go to .journal/journal.jsonl and to the server's own presence entry, which participants cannot write
  presence: a connection may announce only its own client ids; with login the server stamps its identity on them
  compaction: on save the server rewrites the document from its normalized, domain-repaired reading once, so readers never invent data
  validation: reading is deterministic on every replica; merged state runs rule:c4-model-integrity and checks like any project; findings are reported, merges are never rejected
  persistence: data:project-store YAML tree plus .crdt/state.bin so reconnecting replicas merge into one history; YAML edited on disk while stopped is applied as an edit by "Files on disk"
agents: api:mcp-server runs a tool on a working copy and writes it as one transaction, so failures leave nothing behind and success is one undo step
undo: Y.UndoManager per participant tracking only its own origin (rule:undo-scope); agent edits undo through the server by agent id
offline: edits stay in the tab while disconnected and merge on reconnect; nothing is queued or rebased by hand
transport: standard Yjs sync and awareness protocol over WebSocket (api:collaboration-gateway); presence carries user, kind, view, and selection
rejected:
  operation_log_with_server_ordering: needs inverse operations and rebase for every command; concurrent field edits to one record would conflict
  peer_to_peer: no authority for read_only, attribution, or headless MCP edits
consequences:
  - collaboration has no conflict state to resolve; the last writer wins on one scalar
  - the browser keeps local snapshot history for local projects and switches to per-participant CRDT undo in a shared project
```

# C4Sketch

Browser-first C4 modeling workbench. The C4 layer (System Context, Container, Component views), the ERD layer (Component ERD per data store, Code ERD per entity), and the DFD layer (use-case data flow diagrams paired with each C4 level) are implemented, together with the vocabulary and domain dictionaries, name display switching, SQL DDL export, and project catalogs; and an optional Bun server adds shared projects, real-time collaboration, and MCP access for coding agents.

## ERD

Double-click a database or database schema container to open its Component ERD, the data store's sibling of the Component view. Entities (tables) carry a description, technology, and classification like C4 elements. Fields live in the inspector field list (type a name, Enter adds; flags for important, PK, required, unique); only fields marked important draw on the card, with a footer counting the rest. The canvas toolbar switches ERD views between descriptive (description text), fields (important rows), and compact. Entity-to-entity links are reference, dependent, inheritance, or label relationships with UML multiplicity at both ends; a reference marked important adds a chain row to the key holder's card. Double-click an entity to open its Code ERD: the entity with its dependent tables (created by quick create inside that view), and the other tables it relates to as gray context. The kind tag shows the storage kind in C4 brackets ("Entity · Event [Table]", "[View]", "[Materialized view]"); entities have no free technology text. Instead the inspector's Volume section records bytes per row, initial rows, growth, refresh, and retention, and derives rows and size at the project horizon; the Data volume button on an ERD toolbar opens a bubble chart of the store's tables sized by that estimate. See `requirement:erd-in-data-store`, `requirement:erd-field-visibility`, and `requirement:data-volume-estimation` in `.knowledge/`.

## DFD

A DFD follows one use case ("Place order") through one software system, from the user's action to the tables, at component granularity: processes are components (a screen, a service, a repository, a job), stores are tables, queues are topics of a pub/sub or queue container, files are folders of a bucket or file share, and an API document is the transient payload of a call. Containers are deployment units and never appear as nodes; they show on a process's kind line. People never appear either: every DFD begins at a start marker, and dropping a person connects the start to the screen that person uses. The `+` beside the Container view tabs creates a DFD; a system's DFDs sit next to its Container views in the navigator and are listed by system in the explorer.

Nodes come two ways. Drag a component, table, topic, or folder from the explorer onto the canvas and it becomes a bound node whose role follows its kind. Or quick create a free node with a chosen role: it draws dashed, exists only in that DFD, and the inspector later places it into the model (a process as a component of an existing container, a new container, or the system's dashed "Unknown container" placeholder; a store as a table of a database; a queue as a topic; a file as a folder) or binds it to an existing element. Deleting an element turns its nodes back into free nodes. A component marked pass-through in the inspector (a controller, gateway, adapter) is not a process: dropped onto a DFD it becomes the API document it handles, captioned "handled by".

Flows come from the link handle. A flow joins a process with a data node or an external entity; linking two data nodes inserts a process. Linking two processes makes them one *logical process*: they join a group and an intermediate data node is inserted between them, an API document by default, or a file or a queue by choice, so every hop stays process → data → process. The group takes the name and picture of its screen, else its job, else its most upstream member, and is numbered like a process; its members number 1.1, 1.2 beneath it, and groups nest. Double-click a group's header to collapse it to one process and double-click the collapsed box to expand it again. Several flows between the same two nodes in the same direction draw as one line; the inspector lists what is on it.

The C4 model grows from the DFD: flows between bound nodes derive C4 relationships (a flow touching a table, topic, or folder derives a link to its data store container; a hop through a document handled by a pass-through component derives the two links through it), drawn on the same one-line-per-pair rule as stored relationships and listed inside them, with a button to materialize a derived line as a stored relationship. The other way round, a stored 1:1 component link between two nodes of a DFD is offered for import as a hop, and imported flows and their relationship draw as one line. Flows carry a label, the tables they move, a technology, and C/R/U/D letters at the store end. Shift-select flows to make a transaction boundary, atomic or eventual; checks flag an atomic boundary that spans two data stores or crosses a queue, free nodes not yet placed, components still in the placeholder, and forward flows that point left. Arrange lays a DFD out left to right from the start marker; a response to a node further left runs back below the main lane as a lighter return lane. Hovering any line highlights it and its endpoints; hovering a node highlights its lines. See `requirement:use-case-dfd`, `decision:dfd-component-granularity`, `decision:dfd-logical-process-group`, `decision:dfd-drives-c4`, `requirement:c4-links-into-dfd`, and `requirement:dfd-flow-direction` in `.knowledge/`.

## Vocabulary and domains

The Catalogs button in the header (or the links under the explorer) replaces the canvas with four tabs: Vocabulary, Domains, Tables, and DFDs. The inspector stays beside it, so a domain row dragged onto a field in the inspector assigns it.

Vocabulary entries give each term a business name (as typed in the model), a system name, and a physical name, plus aliases, meaning, and notes. Table, field, and domain names bind to the vocabulary automatically: the longest registered term wins, case and separators are ignored (`created_at`, `CreatedAt`, and `created at` are one term), and latin terms only match whole words. The inspector shows each name's terms, its derived system and physical names, and one-click registration for unregistered words; the Vocabulary tab lists every unregistered word with its count. Renaming an entry's business name rewrites the names that use it. Terms mentioned in C4 names, descriptions, relationship labels, and DFD flow labels show as links but create no binding; a C4 element can opt into binding. The naming policy sets the identifier case, singular or plural table names, and translation or romaji for names no term covers. Suggest fills missing system and physical names from registered terms first, then the same latin words, romaji for kana, or Chrome's on-device translator when the browser has it; nothing applies until accepted.

Every field is born with a same-named domain (`decision:field-first-domains`); renaming a field moves its automatic domain with it, and domains nobody uses disappear. The Domains tab leads with merge candidates (same name ignoring case and separators, same business name, similar names, same type) and uncurated domains; ticking domains and merging moves every field to the survivor in one undoable step. A domain is untyped, a single field with a canonical PostgreSQL type, a composite of ordered components, or a code set; categories group them. The canvas toolbar switches labels between business, system, physical, and system+physical names; missing forms show the typed name with ⚠, and exports record the mode in the title block.

Export › SQL DDL writes `CREATE TABLE` statements for the open ERD's data store, or for every database: columns follow the domain expansion rule, types render per dialect (PostgreSQL, SQLite, MySQL) with lossy conversions commented, reference and dependent relationships become foreign keys, and tables are ordered by their dependencies. The Tables and DFDs tabs list every table and DFD with filters, sortable and selectable columns, and CSV or Markdown export. See `requirement:vocabulary-dictionary`, `requirement:domain-dictionary`, `requirement:domain-consolidation`, `requirement:name-display-switching`, `requirement:name-suggestion`, `requirement:sql-ddl-export`, and `requirement:project-catalogs` in `.knowledge/`.

## Server and collaboration

The static build is complete on its own. The optional Bun server serves the same frontend, keeps projects as folders of YAML files, lets several people edit one project live, and exposes the model to AI agents over MCP.

```bash
npm run build
bun server/main.ts ./design
```

`./design` becomes one project (an empty folder is initialized; one YAML file per element, relationship, view, term, and domain, so diffs stay reviewable). `--workspace` serves a folder of project folders and lets the browser create and share projects. The Server button in the header lists the server's projects, shares the open local project, and shows the live session: connection state, participants with the view they are in, recent changes with who made them, and the MCP address. Others' selections are outlined on the canvas in their color.

Collaboration is a CRDT (`decision:crdt-collaboration`): the project is a Yjs document, so edits to different elements, fields, and node positions merge, fields added to one table at the same time are both kept, and one value edited twice keeps the later write. Undo reverts only your own changes. Offline edits stay in the tab and merge when the connection returns. The server is the only relay; it records every change with its author in `.journal/journal.jsonl` and keeps the document state in `.crdt/` so reconnecting tabs merge into one history. YAML edited by hand while the server is stopped is picked up at the next start.

The server binds 127.0.0.1 without login. To share on a network, give each user a token: `--host 0.0.0.0 --token alice:secret --token guest:secret2:read_only`. A read-only user can follow along but cannot change anything.

Coding agents connect to `http://127.0.0.1:8787/mcp` (streamable HTTP), or run the server with `--stdio` so a local agent talks MCP on standard input and output. They get the same tools as the in-browser WebMCP surface plus `list_projects`, `open_project`, and `undo_last_edit`, and resources for the project JSON, check findings, diagram SVGs, and DDL. Each tool call applies as one change that appears live in the browsers, attributed to the agent, and a failed call changes nothing; the Undo button beside an agent's change in the activity list reverts it.

`npm run build:server` builds a single executable in `release/` with the frontend embedded; the `Dockerfile` builds an image that serves `/data`. `npm test` runs the CRDT, YAML, and server tests with Bun.

## Develop

```bash
npm ci
npm run dev
```

`npm run build` type-checks and bundles the static site. The app runs entirely in the browser; projects persist to local storage and export as JSON. With `npm run server` running beside `npm run dev`, the dev server forwards `/api` and `/mcp` to it.

Every push to `main` runs the same build in GitHub Actions (`.github/workflows/deploy-pages.yml`) and publishes `dist/` to GitHub Pages at https://shibukawa.github.io/archidiag/.

## Layout

- `src/core/` — runtime-neutral model, commands, view projection, side-port routing, style themes, legend and title-block frame, layered auto layout, layout helpers, checks, JSON migration, draw.io export, vocabulary resolution, domains, name suggestions, SQL DDL, catalogs, the AI tool surface, the Yjs document mapping, and the YAML folder format. No DOM or React imports.
- `server/` — the optional Bun server: project store, collaboration rooms, MCP endpoint, CLI.
- `tests/` — Bun tests for the CRDT mapping, the YAML store, and the server end to end.
- `src/ui/` — React editor: canvas (renders the same SVG the exports use), explorer, inspector, quick create, validation panel, dictionary and catalog panel, WebMCP tool surface, browser exporters.
- `.knowledge/` — the requirement catalog (knowledge-compiler format).

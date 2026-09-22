# C4Sketch

Browser-first C4 modeling workbench. The C4 layer (System Context, Container, Component views), the ERD layer (Component ERD per data store, Code ERD per entity), and the DFD layer (use-case data flow diagrams paired with each C4 level) are implemented; vocabulary, domains, and the Bun server follow the requirements in `.knowledge/`.

## ERD

Double-click a database or database schema container to open its Component ERD, the data store's sibling of the Component view. Entities (tables) carry a description, technology, and classification like C4 elements. Fields live in the inspector field list (type a name, Enter adds; flags for important, PK, required, unique); only fields marked important draw on the card, with a footer counting the rest. The canvas toolbar switches ERD views between descriptive (description text), fields (important rows), and compact. Entity-to-entity links are reference, dependent, inheritance, or label relationships with UML multiplicity at both ends; a reference marked important adds a chain row to the key holder's card. Double-click an entity to open its Code ERD: the entity with its dependent tables (created by quick create inside that view), and the other tables it relates to as gray context. The kind tag shows the storage kind in C4 brackets ("Entity · Event [Table]", "[View]", "[Materialized view]"); entities have no free technology text. Instead the inspector's Volume section records bytes per row, initial rows, growth, refresh, and retention, and derives rows and size at the project horizon; the Data volume button on an ERD toolbar opens a bubble chart of the store's tables sized by that estimate. See `requirement:erd-in-data-store`, `requirement:erd-field-visibility`, and `requirement:data-volume-estimation` in `.knowledge/`.

## DFD

A DFD follows one use case ("Place order") through one software system, from the user's action to the tables, at component granularity: processes are components (a screen, a service, a repository, a job), stores are tables, queues are topics of a pub/sub or queue container, files are folders of a bucket or file share, and an API document is the transient payload of a call. Containers are deployment units and never appear as nodes; they show on a process's kind line. People never appear either: every DFD begins at a start marker, and dropping a person connects the start to the screen that person uses. The `+` beside the Container view tabs creates a DFD; a system's DFDs sit next to its Container views in the navigator and are listed by system in the explorer.

Nodes come two ways. Drag a component, table, topic, or folder from the explorer onto the canvas and it becomes a bound node whose role follows its kind. Or quick create a free node with a chosen role: it draws dashed, exists only in that DFD, and the inspector later places it into the model (a process as a component of an existing container, a new container, or the system's dashed "Unknown container" placeholder; a store as a table of a database; a queue as a topic; a file as a folder) or binds it to an existing element. Deleting an element turns its nodes back into free nodes. A component marked pass-through in the inspector (a controller, gateway, adapter) is not a process: dropped onto a DFD it becomes the API document it handles, captioned "handled by".

Flows come from the link handle. A flow joins a process with a data node or an external entity; linking two data nodes inserts a process. Linking two processes makes them one *logical process*: they join a group and an intermediate data node is inserted between them, an API document by default, or a file or a queue by choice, so every hop stays process → data → process. The group takes the name and picture of its screen, else its job, else its most upstream member, and is numbered like a process; its members number 1.1, 1.2 beneath it, and groups nest. Double-click a group's header to collapse it to one process and double-click the collapsed box to expand it again. Several flows between the same two nodes in the same direction draw as one line; the inspector lists what is on it.

The C4 model grows from the DFD: flows between bound nodes derive C4 relationships (a flow touching a table, topic, or folder derives a link to its data store container; a hop through a document handled by a pass-through component derives the two links through it), drawn on the same one-line-per-pair rule as stored relationships and listed inside them, with a button to materialize a derived line as a stored relationship. The other way round, a stored 1:1 component link between two nodes of a DFD is offered for import as a hop, and imported flows and their relationship draw as one line. Flows carry a label, the tables they move, a technology, and C/R/U/D letters at the store end. Shift-select flows to make a transaction boundary, atomic or eventual; checks flag an atomic boundary that spans two data stores or crosses a queue, free nodes not yet placed, components still in the placeholder, and forward flows that point left. Arrange lays a DFD out left to right from the start marker; a response to a node further left runs back below the main lane as a lighter return lane. Hovering any line highlights it and its endpoints; hovering a node highlights its lines. See `requirement:use-case-dfd`, `decision:dfd-component-granularity`, `decision:dfd-logical-process-group`, `decision:dfd-drives-c4`, `requirement:c4-links-into-dfd`, and `requirement:dfd-flow-direction` in `.knowledge/`.

## Develop

```bash
npm ci
npm run dev
```

`npm run build` type-checks and bundles the static site. The app runs entirely in the browser; projects persist to local storage and export as JSON.

Every push to `main` runs the same build in GitHub Actions (`.github/workflows/deploy-pages.yml`) and publishes `dist/` to GitHub Pages at https://shibukawa.github.io/archidiag/.

## Layout

- `src/core/` — runtime-neutral model, commands, view projection, side-port routing, style themes, legend and title-block frame, layered auto layout, layout helpers, checks, JSON migration, draw.io export. No DOM or React imports.
- `src/ui/` — React editor: canvas (renders the same SVG the exports use), explorer, inspector, quick create, validation panel, WebMCP tool surface, browser exporters.
- `.knowledge/` — the requirement catalog (knowledge-compiler format).

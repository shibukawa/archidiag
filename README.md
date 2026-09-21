# C4Sketch

Browser-first C4 modeling workbench. The C4 layer (System Context, Container, Component views) and the ERD layer (Component ERD per data store, Code ERD per entity) are implemented; DFD, vocabulary, domains, and the Bun server follow the requirements in `.knowledge/`.

## ERD

Double-click a database or database schema container to open its Component ERD, the data store's sibling of the Component view. Entities (tables) carry a description, technology, and classification like C4 elements. Fields live in the inspector field list (type a name, Enter adds; flags for important, PK, required, unique); only fields marked important draw on the card, with a footer counting the rest. The canvas toolbar switches ERD views between descriptive (description text), fields (important rows), and compact. Entity-to-entity links are reference, dependent, inheritance, or label relationships with UML multiplicity at both ends; a reference marked important adds a chain row to the key holder's card. Double-click an entity to open its Code ERD: the entity with its dependent tables (created by quick create inside that view), and the other tables it relates to as gray context. The kind tag shows the storage kind in C4 brackets ("Entity · Event [Table]", "[View]", "[Materialized view]"); entities have no free technology text. Instead the inspector's Volume section records bytes per row, initial rows, growth, refresh, and retention, and derives rows and size at the project horizon; the Data volume button on an ERD toolbar opens a bubble chart of the store's tables sized by that estimate. See `requirement:erd-in-data-store`, `requirement:erd-field-visibility`, and `requirement:data-volume-estimation` in `.knowledge/`.

## Develop

```bash
npm ci
npm run dev
```

`npm run build` type-checks and bundles the static site. The app runs entirely in the browser; projects persist to local storage and export as JSON.

## Layout

- `src/core/` — runtime-neutral model, commands, view projection, side-port routing, style themes, legend and title-block frame, layered auto layout, layout helpers, checks, JSON migration, draw.io export. No DOM or React imports.
- `src/ui/` — React editor: canvas (renders the same SVG the exports use), explorer, inspector, quick create, validation panel, WebMCP tool surface, browser exporters.
- `.knowledge/` — the requirement catalog (knowledge-compiler format).

# C4Sketch

Browser-first C4 modeling workbench. The C4 layer (System Context, Container, Component views) is implemented; ERD, DFD, vocabulary, domains, and the Bun server follow the requirements in `.knowledge/`.

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

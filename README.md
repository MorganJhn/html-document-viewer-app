# HTML Document Viewer

A local/private-network webapp for reviewing paginated HTML documents without converting back and forth through PDF during revisions.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4174`.

The default document workspace is `./workspace`. You can change it in the app, or set `DOCUMENT_WORKSPACE` before starting the server.

For remote/private-network access:

```bash
set HOST=0.0.0.0
set HDV_TOKEN=your-token
npm run dev
```

Remote write/export requests require the token in the app's Remote token field. Localhost write/export requests do not require a token.

## Features

- Server-side workspace picker and automatic `.html` / `.htm` document detection.
- Paginated iframe preview with page size, orientation, margins, and background controls.
- Component selector with hover highlight, click selection, Ctrl/Shift multi-select, and drag selection.
- Selection popover with copyable `HDV_REF` component references for agent handoff.
- Tabbed inspector with selection properties, document page setup, and component library workflows.
- Inspector with readable computed properties and live inline edits for safe element-level revisions.
- Source HTML save with backups under `<workspace>/_hdv/backups`.
- Viewable HTML export and PDF export under `<workspace>/_hdv/exports`.
- Cross-document component library stored under `<workspace>/_hdv/templates`.
- Component library rename/delete, search, source document metadata, and insert placement controls.

## Document Annotations

The viewer works with arbitrary HTML. Add optional attributes for better component names:

```html
<section data-component="Executive summary" data-hdv-id="executive-summary">
  ...
</section>
```

Name priority is `data-component`, `data-name`, `aria-label`, `id`, then inferred tag/class/text. Stable agent references prefer `data-hdv-id`, then `data-component`, `data-name`, and `id`.

## Agent Workflow

Agents should read [AGENTS.md](AGENTS.md) before revising documents. The nested workflow guide in [docs/agent-workflow](docs/agent-workflow/README.md) explains workspace layout, copied `HDV_REF` strings, component naming, reusable templates, and the review loop.

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

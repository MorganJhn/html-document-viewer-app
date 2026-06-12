# Agent-App Connection Flow

HTML Document Viewer connects three roles:

- The agent creates and revises source HTML documents.
- The app renders those documents as paginated pages and exposes selectable components.
- The user reviews the rendered result and sends exact component references back to the agent.

The goal is to avoid the HTML-to-PDF-to-HTML revision loop. HTML stays editable, the user reviews a paginated view, and exports are produced only when needed.

## Standard Review Loop

1. Agent creates or updates an HTML document in the active workspace.
2. Agent starts the app, or confirms it is already running.
3. User opens the app and selects the document.
4. App renders the source document in a same-origin iframe with pagination.
5. User turns on Select mode and clicks or drags over rendered components.
6. App shows readable labels plus copyable `HDV_REF` strings.
7. User sends one or more references to the agent with requested changes.
8. Agent resolves each reference in source HTML and edits the source.
9. User refreshes or reopens the document in the app.
10. User exports viewable HTML or PDF when the document is approved.

## What Agents Should Produce

Documents should be easy to inspect at both the rendered and source level. For major sections, add both a human label and a stable agent identifier:

```html
<section data-component="Executive summary" data-hdv-id="executive-summary">
  ...
</section>
```

Use `data-component` for the name a human sees and says. Use `data-hdv-id` for the durable identifier an agent can search across revisions.

Add metadata to:

- cover pages,
- major sections,
- repeated cards,
- figures,
- charts,
- tables,
- callouts,
- footnotes,
- headers and footers,
- template candidates,
- components the user is likely to request later.

## What Users Expect From Agents

When a user sends:

```text
HDV_REF file="brief.html" path="0.1.3.2" tag="p" component="Risk note"
```

the agent should open `workspace/brief.html`, find the `Risk note` component, confirm it is a paragraph in the expected context, and make the requested edit. The user should not need to explain selectors, DOM structure, source files, or where the component appears on the page.

If the reference points to a small child element, the agent may inspect nearby parent components before editing. If the user asks for "this whole box" but selected the title inside the box, use context to identify the surrounding component and preserve the narrow intent.

## Local App

Run:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4174
```

Localhost write and export actions do not require a token.

## Remote Or Private-Network App

Run:

```bash
set HOST=0.0.0.0
set HDV_TOKEN=your-token
npm run dev
```

Expose the server with Tailscale, port forwarding, or a tunnel such as cloudflared. Tell the user the URL and token. The user must enter the same token in the app's Remote token field for workspace changes, saves, component library writes, and exports.

## App State Boundaries

The app does not replace source control or agent judgment. It provides:

- workspace discovery,
- paginated preview,
- component selection,
- minor safe edits,
- document settings controls,
- reusable component records,
- backups,
- exports.

The agent remains responsible for structural revisions, source quality, asset paths, semantic markup, stable component names, and final verification.

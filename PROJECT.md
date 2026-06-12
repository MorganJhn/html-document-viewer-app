# HTML Document Viewer — Technical Project Documentation & Agent Handoff

Welcome! This document provides a complete technical handoff for other coding agents working on this repository. It outlines the project's architecture, key components, layout systems, recent visual refactoring, and local rules to help you contribute safely.

---

## 1. Project Overview & Architecture

The **HTML Document Viewer** is a local web application designed to let human reviewers inspect paginated HTML documents, select exact rendered components, perform safe modifications, and export approved documents directly back to source HTML, backups, or PDF.

The codebase is split into:
1. **Frontend App (React + Vite + TypeScript)**:
   - Orchestrated in [App.tsx](file:///d:/Projects/HTML%20Document%20Viewer/src/App.tsx).
   - Utilizes custom styling in [App.css](file:///d:/Projects/HTML%20Document%20Viewer/src/App.css) (Vanilla CSS) for glassmorphism and responsiveness.
   - Embeds the reviewed document within a sandbox `<iframe>` (in [App.tsx](file:///d:/Projects/HTML%20Document%20Viewer/src/App.tsx)) and synchronizes click, select, Ctrl/Shift batch, and drag selections into a global React state.
2. **Backend Workspace API (Node.js + Express + TypeScript)**:
   - Hosted under the `server/` directory, started by [server/index.ts](file:///d:/Projects/HTML%20Document%20Viewer/server/index.ts).
   - [server/app.ts](file:///d:/Projects/HTML%20Document%20Viewer/server/app.ts): Exposes API routes to load documents, query paths, fetch workspace configs, list and save templates, rename or delete components, and trigger HTML/PDF exports.
   - [server/html.ts](file:///d:/Projects/HTML%20Document%20Viewer/server/html.ts): Handles HTML manipulation, path calculation, and safe source saves.
   - [server/paths.ts](file:///d:/Projects/HTML%20Document%20Viewer/server/paths.ts): Resolves structural component tags, hierarchical paths, and IDs.
   - [server/templates.ts](file:///d:/Projects/HTML%20Document%20Viewer/server/templates.ts): Manages saved templates in the component library.
   - [server/exporter.ts](file:///d:/Projects/HTML%20Document%20Viewer/server/exporter.ts): Integrates Puppeteer for high-fidelity PDF page generation.

---

## 2. The Unified Docking & Layout System

The application features three main control panels that can float freely or snap into dock zones (`dock-left`, `dock-right`, and `dock-bottom`):
- **Navigator**: File browser and page view list.
- **Inspector**: Multi-tab panel for Selection properties, Page setup, and Component library details.
- **Selection Popover**: Contextual reference menu for the active selection.

### Drag & Snap Calculations
Docking snap calculations are hosted in [FloatingPanel.tsx](file:///d:/Projects/HTML%20Document%20Viewer/src/components/FloatingPanel.tsx). Snapping is cursor-based: it measures the active dragging cursor position relative to the workspace viewport edges, making the snap drop zones independent of panel sizing.

### Complementary Column Resizing
When multiple panels are docked side-by-side (e.g., Navigator and Inspector), the workspace column widths are adjusted complementarily: resizing one panel automatically updates the adjacent panel's width to preserve overall layout stability.

### Startup Height & State Normalization
A dedicated normalization system is executed during React initialization in [App.tsx](file:///d:/Projects/HTML%20Document%20Viewer/src/App.tsx):
- Restores layout state from local storage.
- If a panel is docked in `dock-bottom`, it forces its height (`h`) to **exactly 400px** and locks its resizability to prevent user states from breaking horizontal alignments.

---

## 3. Bottom-Dock Ribbon Layout (`dock-bottom`)

When panels are docked in `dock-bottom`, they transition into a horizontal "ribbon" layout optimized for restricted vertical dimensions.

```
+--------------------------------------------------------------------------------------------+
| (Titlebar) | (Tab Icons) |  [CARD 1: IDENTITY]  |  [CARD 2: TEXT]  |  [CARD 3: TYPOGRAPHY] |
| 🌢 Grip     |   🔍 Sel    | Label: component-tag |                  | Size: [___] Color:[_] |
|   Title    |   ⚙ Doc     | Name:  [__________]  |  [Text Area]     | Bg:   [___] Opacity:[]|
|   Actions  |   🗃 Lib     | References... [Copy] |                  |                       |
+--------------------------------------------------------------------------------------------+
```

### A. Titlebar Refactoring
- To maximize vertical canvas space, the traditional top horizontal titlebar is removed.
- A **vertical titlebar** (`32px` wide) is rendered on the left corner of the panel in [FloatingPanel.tsx](file:///d:/Projects/HTML%20Document%20Viewer/src/components/FloatingPanel.tsx). It hosts a vertical grab handle (`writingMode: 'vertical-lr'`), rotated panel title, and compact action buttons (minimize/close).

### B. Vertical Tabs & Horizontal Content
- In [InspectorPanel.tsx](file:///d:/Projects/HTML%20Document%20Viewer/src/components/InspectorPanel.tsx), the active tabs render as a vertical icon column next to the vertical titlebar.
- The tab content containers are configured to display child cards side-by-side (`flexDirection: 'row'`, `overflowY: 'hidden'`).

### C. Reusable Horizontal Scroller with Navigation Arrows
- To ensure no controls are cut off on smaller viewports, cards are loaded inside the `<HorizontalScrollContainer>` component defined in [ui.tsx](file:///d:/Projects/HTML%20Document%20Viewer/src/components/ui.tsx).
- Native vertical and horizontal scrollbars are fully hidden via `.hide-scrollbar` styling rules in [App.css](file:///d:/Projects/HTML%20Document%20Viewer/src/App.css).
- The scroller uses a `ResizeObserver` to monitor child layouts and dynamically displays **smooth scroll arrows** on the left/right boundaries when content overflows.

### D. Dark Theme Form Controls Styling
- Inputs, selects, and textareas inside the bottom ribbon are styled under the `.inspector-panel-bottom` scope in [App.css](file:///d:/Projects/HTML%20Document%20Viewer/src/App.css).
- They explicitly override browser defaults to use translucent dark backgrounds (`rgba(0, 0, 0, 0.22)`), standard border states, and matching text colors, resolving visual bugs where fields rendered as blank white rectangles.

### E. Layout & Size Card & Overlap Prevention
- The Layout & Dimensions card has an expanded `minWidth: '420px'` to prevent horizontal cramped space.
- Static grid rows are replaced with a dual-column flex list using `BottomProperty` helper components:
  - Flex properties are pushed to opposite sides (`justify-content: space-between`).
  - Values use `white-space: nowrap` and `text-overflow: ellipsis` rules to safely truncate layout values (e.g. margin, padding, border) without text collision.

---

## 4. Coding Commands & Verification

Always verify your changes compile and pass both unit and integration checks:

### Visual Styles & Linter
Make sure there are no syntax warnings:
```bash
npm run lint
```

### Production Bundling
Ensure TypeScript and Vite compile the package cleanly:
```bash
npm run build
```

### Unit Tests
Verify file path resolutions, server API endpoints, and selection computations:
```bash
npm test
```

### End-to-End (E2E) Integration Tests
Launch Playwright tests to simulate user selections, document reviews, saving, and template insertions:
```bash
npm run test:e2e
```

---

## 5. Primary Rules for Coding Agents

When editing or updating this codebase, you MUST adhere to the following contracts:
1. **Preserve Metadata**: Never discard `data-component`, `data-name`, `data-hdv-id`, or `id` attributes. These are the primary identifiers for user references (`HDV_REF`).
2. **Page Styles**: Keep page presets, size rules, orientation overrides, and margin styles within the `<style data-hdv-document-settings>` block. Custom document styling should reside in a separate style block.
3. **No Vertical Scrolling in Bottom Dock**: All bottom-docked tabs and panel contents must flow horizontally. Ensure child elements do not stack vertically.
4. **Relativity of Assets**: Always use relative paths for images and stylesheets so exports under `<workspace>/_hdv/exports` resolve correctly.
5. **No Local Backups Deletions**: Leave the backups under `<workspace>/_hdv/backups/` intact unless explicitly asked.

Refer to the primary developer instructions in [AGENTS.md](file:///d:/Projects/HTML%20Document%20Viewer/AGENTS.md) and the guides in `docs/agent-workflow/` for complete details.

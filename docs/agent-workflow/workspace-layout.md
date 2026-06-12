# Workspace And File Layout

The document workspace is where agents and the app meet. The app scans this folder for `.html` and `.htm` source documents and stores review artifacts under `_hdv`.

## Default Layout

```text
workspace/
  sample-document.html
  report.html
  policy-brief.html
  assets/
    chart.png
  _hdv/
    backups/
    exports/
    templates/
```

## Source Documents

Put generated or revised source documents directly under the active workspace or nested folders inside it.

Allowed:

```text
workspace/report.html
workspace/client-a/brief.html
workspace/assets/chart.png
```

Avoid:

```text
dist/report.html
workspace/_hdv/exports/report.html
desktop-final-final.html
```

The app treats source HTML as the canonical document. Exports are outputs, not editing targets.

## Active Workspace

The user can choose a server-side workspace path in the app. Agents should inspect the active workspace before assuming `workspace/` if:

- no documents appear,
- an `HDV_REF file="..."` does not resolve,
- the user says they changed the workspace,
- generated documents seem to be missing.

The local app config is stored at:

```text
.hdv/config.json
```

## `_hdv` Folder

The app owns this folder.

- `backups/`: automatic copies made before source writes.
- `exports/`: viewable HTML packages and PDF exports.
- `templates/`: component library records.

Agents may read `_hdv` when useful, but normal source edits should happen in the original workspace HTML document, not inside `_hdv`.

## Backups

Before the app writes source changes, it creates a backup under:

```text
workspace/_hdv/backups/
```

If a user says an app edit broke something, compare the current source document with the latest backup. Do not delete backups unless the user explicitly asks.

## Exports

Viewable HTML and PDF exports are written under:

```text
workspace/_hdv/exports/
```

Exports are for sharing or final review. Do not edit exported HTML and then expect the source document to update. Make changes in the source document and export again.

## Assets

Keep document-specific assets next to the document or in a workspace asset folder. Use relative paths so app rendering, HTML export, and PDF export can resolve them.

Good:

```html
<img src="assets/chart.png" alt="Installed capacity chart">
```

Bad:

```html
<img src="C:\Users\name\Downloads\chart.png">
```

For cross-document reusable assets, prefer a shared workspace folder such as `workspace/assets/`.

## File Naming

Use stable, descriptive filenames:

```text
annual-report-2026.html
client-a-proposal.html
policy-brief-energy.html
```

Avoid vague or revision-heavy names. The app already handles backups and exports, so names like `final-v7-revised.html` make references harder to use.

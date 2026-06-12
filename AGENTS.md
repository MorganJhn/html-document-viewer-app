# Agent Guide For HTML Document Viewer

This repository is both an app codebase and an agent-facing document workspace. The app lets a human review paginated HTML documents, select exact rendered components, copy agent-identifiable references, make small safe edits, save those edits back to source HTML, and export approved documents to viewable HTML or PDF.

Read this file before modifying app code, generated documents, templates, exports, or workspace configuration.

## Local Operating Rules

Prioritize output quality over speed. If ambiguity could cause rework, ask concise clarifying questions before proceeding. For significant tasks, outline the approach before implementation and divide large work into resumable parts.

Use the most reliable method available, not the fastest. Preserve user work, avoid broad unrelated refactors, and verify changes with the relevant tests or browser checks before reporting completion.

## Required Reading

Start here, then open the topic page that matches the task:

- [Agent workflow index](docs/agent-workflow/README.md)
- [Agent-app connection flow](docs/agent-workflow/agent-app-flow.md)
- [Component reference format](docs/agent-workflow/component-references.md)
- [Workspace and file layout](docs/agent-workflow/workspace-layout.md)
- [Document authoring rules](docs/agent-workflow/document-authoring.md)
- [Component library workflow](docs/agent-workflow/component-library.md)
- [Revision and troubleshooting playbook](docs/agent-workflow/revision-playbook.md)

## Primary Contract

The user may know nothing about this app. The agent is responsible for preserving the workflow.

1. Put reviewable HTML documents in the configured workspace folder, normally `workspace/`.
2. Start or use the app at `http://127.0.0.1:4174`.
3. Make documents component-friendly with meaningful `data-component` names.
4. Add stable `data-hdv-id` values to important, repeated, or likely-to-be-referenced components.
5. Treat copied `HDV_REF ...` strings from the app as the authoritative user pointer.
6. Resolve references in source HTML, make targeted edits, and preserve component metadata.
7. Use the component library when the user wants blocks reused across documents.
8. Keep exports and backups under `_hdv` intact.

## What The User Will Do

The user opens the app, selects a workspace, opens a document, turns on Select mode, clicks or drags over rendered components, and copies the selection reference. The copied text is designed for agents first and humans second. It looks like this:

```text
HDV_REF file="sample-document.html" path="0.1.0.0" tag="h1" id="main-headline" component="Main headline" selector="data-hdv-id=main-headline"
```

When the user gives you one of these references, do not ask them to describe where the component is. Open the referenced file and locate the component using the reference fields.

## What The Agent Must Do

For every document change:

- Read the current source HTML under the active workspace before editing.
- Edit the source document, not the exported HTML or PDF.
- Keep changes scoped to the referenced component unless the user asks for broader work.
- Preserve or improve `data-component`, `data-name`, `data-hdv-id`, and `id` attributes.
- Keep page controls in `<style data-hdv-document-settings>` when changing page size, margins, orientation, or background.
- Use relative asset paths so preview, HTML export, and PDF export work from the workspace.
- Tell the user to refresh or reopen the document in the app after source edits.

For user references:

- Prefer stable selectors in this order: `data-hdv-id`, `data-component`, `data-name`, `id`.
- Use `path` as a current-source fallback, not as a long-term semantic identifier.
- Confirm the tag, nearby text, and document context before editing.
- If a reference is ambiguous, ask for a parent or nearby copied reference only after reasonable source search fails.

## Important Paths

- App code: `src/`, `server/`, `tests/`
- Default document workspace: `workspace/`
- App config: `.hdv/config.json`
- Workspace app data: `workspace/_hdv/`
- Backups: `workspace/_hdv/backups/`
- Exports: `workspace/_hdv/exports/`
- Component library records: `workspace/_hdv/templates/`
- Agent guide details: `docs/agent-workflow/`

## Commands

```bash
npm run dev
npm test
npm run lint
npm run build
npm run test:e2e
```

For private-network or tunneled access:

```bash
set HOST=0.0.0.0
set HDV_TOKEN=your-token
npm run dev
```

Remote write and export actions require the user to enter the same token in the app's Remote token field. Localhost write and export actions do not require a token.

## Non-Negotiables

- Do not generate final source documents outside the active workspace unless the user explicitly asks.
- Do not remove user-authored component metadata casually.
- Do not treat a human-readable label alone as enough when an `HDV_REF` is available.
- Do not edit exported HTML or PDF as the source of truth.
- Do not delete `_hdv` backups, exports, or templates unless the user asks.
- Do not hand-edit template records unless the task is specifically about the component library.
- Do not make broad app refactors while performing a document revision.

# Agent Workflow Index

This folder is the detailed guide for the agent-app connection. Use it when a user reviews a document in HTML Document Viewer and asks for revisions by pointing at rendered components.

## Fast Path

1. Confirm the active workspace. The default is `workspace/`.
2. Open or create the source `.html` file under that workspace.
3. Add stable component metadata while authoring: `data-component` and, for durable references, `data-hdv-id`.
4. Let the user review the document in the app.
5. When the user sends an `HDV_REF ...` string, resolve it in the source file and edit only the intended component.
6. Tell the user what changed and ask them to refresh or reopen the document in the app.
7. Export only when the user asks or the document is approved.

## Topic Map

- [Agent-app connection flow](agent-app-flow.md): complete review loop and local/remote hosting behavior.
- [Component reference format](component-references.md): how copied references are built and how agents should resolve them.
- [Workspace and file layout](workspace-layout.md): where documents, assets, exports, backups, and templates live.
- [Document authoring rules](document-authoring.md): how to write HTML that is easy to select, revise, paginate, and export.
- [Component library workflow](component-library.md): how reusable blocks are saved, inserted, and maintained.
- [Revision and troubleshooting playbook](revision-playbook.md): how to handle ambiguous references, pagination drift, remote token issues, and stale source.

## Core Principle

The source HTML in the active workspace is the source of truth. The app is the review and editing surface. The copied `HDV_REF` string is the user's precise pointer into that source.

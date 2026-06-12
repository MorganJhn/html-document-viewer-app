# Component Library Workflow

The component library stores reusable HTML blocks across documents in the active workspace. It is meant for sections, cards, callouts, tables, figures, headers, footers, and other blocks the user wants to copy between documents.

## Where Components Live

```text
workspace/_hdv/templates/
```

Each saved component is a JSON record with:

- `id`
- `name`
- `html`
- `sourceDocumentId`
- `sourceDocumentPath`
- `previewText`
- `createdAt`
- `updatedAt`

The app manages these files through its API. Prefer the app for creating, renaming, deleting, and inserting components.

## User Workflow

1. User selects a rendered component.
2. User opens the `Component library` inspector tab.
3. User enters a component name.
4. User chooses whether to inline computed styles.
5. User clicks `Save as component`.
6. In another document, user selects an insertion target.
7. User chooses the saved component and placement.
8. User clicks `Insert component`.

## Agent Workflow

Agents should make reusable components easy to save:

```html
<aside data-component="Reviewer note" data-hdv-id="reviewer-note">
  ...
</aside>
```

When asked to reuse a component:

1. Check whether a suitable component exists in `workspace/_hdv/templates/`.
2. If the user saved it through the app, prefer inserting through the app or its API.
3. If editing manually, copy the template `html` into the target source file.
4. Update duplicate `data-hdv-id` and `id` values in the target document.
5. Confirm pagination and local styles still work.

## Inline Computed Styles

The app can inline computed styles when saving a component. This improves portability when moving a block into a document that does not share the original stylesheet.

Use inline computed styles when:

- the target document has different CSS,
- the component is visually complex,
- the user expects an exact visual match.

Avoid inline computed styles when:

- documents share a stylesheet,
- the component should inherit target document typography,
- maintainability matters more than exact portability.

## Duplicate IDs

Component templates can include `data-hdv-id` and `id`. When inserting the same component multiple times into one document, duplicates may occur. Agents should resolve duplicates during manual source edits.

Example:

```html
data-hdv-id="reviewer-note-methodology"
data-hdv-id="reviewer-note-limitations"
```

## Component Metadata After Insertion

After insertion, the copied block should still be selectable and agent-identifiable. Keep or add:

```html
data-component="..."
data-hdv-id="..."
```

If the inserted component changes meaning in the new document, update the component name to match the new role while keeping it searchable.

## Rename And Delete

Renaming a library component changes the library record. It does not automatically update already inserted components in source documents. Deleting a library component removes it from future reuse only.

Do not delete templates merely because a source document was renamed or removed. Ask the user first unless they explicitly requested cleanup.

## Manual Template Edits

Hand-edit template JSON only when the task is specifically about repairing or migrating the component library. For normal revisions, edit source HTML documents or use the app/API insertion flow.

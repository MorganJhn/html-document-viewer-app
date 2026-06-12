# Document Authoring Rules

Write HTML documents so both humans and agents can review them reliably. A document should be visually polished, printable, and source-navigable.

## Semantic Structure

Use semantic HTML for major blocks:

```html
<main data-component="Cover page" data-hdv-id="cover-page">
  <h1 data-component="Main headline" data-hdv-id="main-headline">...</h1>
</main>
```

Prefer:

- `main`
- `section`
- `article`
- `header`
- `footer`
- `figure`
- `figcaption`
- `table`
- `aside`
- `nav` when appropriate

Avoid anonymous nested `div` structures unless layout requires them. If a `div` is meaningful to the user, give it component metadata.

## Component Metadata

Use `data-component` for every meaningful review target:

```html
<section data-component="Findings section">
```

Use `data-hdv-id` for stable references:

```html
<section data-component="Findings section" data-hdv-id="findings-section">
```

Use `data-name` for smaller internal parts when `data-component` would be too prominent:

```html
<span data-name="Footnote marker">1</span>
```

Keep component names stable across revisions. If only the text changes, do not rename the component unless the role of the component changed.

## Naming Pattern

Good component names are readable and specific:

```html
data-component="Quarterly revenue chart"
data-component="Risk mitigation table"
data-component="Executive summary callout"
```

Weak names are generic or layout-only:

```html
data-component="Box"
data-component="Left div"
data-component="Text 3"
```

Use `data-hdv-id` for machine-stable targeting:

```html
data-hdv-id="quarterly-revenue-chart"
data-hdv-id="risk-mitigation-table"
data-hdv-id="executive-summary-callout"
```

## Pagination

Keep print and preview pagination in CSS:

```css
@page {
  size: A4 portrait;
  margin: 20mm;
}

.page {
  break-after: page;
}
```

The app stores document-level controls in:

```html
<style data-hdv-document-settings>
...
</style>
```

Do not remove that block unless replacing it with an equivalent settings block. The document controls in the app update this managed block.

## Page-Sized Documents

For documents with explicit pages, use page containers with stable names:

```html
<section class="page" data-component="Page 1 - cover" data-hdv-id="page-1-cover">
  ...
</section>
```

For flowing documents, rely on CSS paged media and avoid hard-coded viewport units that break print sizing.

## Tables, Figures, And Repeated Blocks

Make repeated structures explicit:

```html
<article data-component="Evidence card - energy security" data-hdv-id="evidence-card-energy-security">
  <h3 data-component="Evidence card title">Energy security</h3>
  <p data-component="Evidence card body">...</p>
</article>
```

For tables:

```html
<table data-component="Budget comparison table" data-hdv-id="budget-comparison-table">
```

For figures:

```html
<figure data-component="Emissions trend chart" data-hdv-id="emissions-trend-chart">
```

For repeated items, avoid duplicated `data-hdv-id` values. Add a topic, index, or stable source key.

## Live Edits From The App

The app can apply minor source edits:

- text content,
- inline color, background, font, size, spacing, border, and transform styles,
- element-level attributes,
- document settings,
- template insertion.

These edits write back to source HTML and create a backup first. Agents should read the source file again before making additional edits after the user has saved changes in the app.

## Larger Revisions

For structural changes, agents should edit source HTML directly. After editing:

1. Keep metadata intact or improve it.
2. Keep relative assets valid.
3. Preserve pagination rules.
4. Verify the document in the app when layout matters.
5. Tell the user to refresh or reopen the document in the app.

## Scripted Documents

Heavily scripted documents may render dynamic state that is not directly present in source HTML. If a user selects runtime-generated content, find the source template, script, or data that produces it. Do not claim the app can persist arbitrary runtime state unless the source contains an editable element for it.

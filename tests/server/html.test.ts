import { describe, expect, it } from 'vitest'
import {
  addRuntimeAttributes,
  applyDocumentEdits,
  insertTemplateHtml,
  readDocumentSettings,
  readGlobalStyle,
  upsertDocumentSettings,
  upsertGlobalStyle,
  type DocumentSettings,
} from '../../server/html'

const source = `<!doctype html>
<html>
<head><title>Test</title></head>
<body>
<main data-component="Cover"><h1 class="title">Original</h1><p>Lead</p></main>
</body>
</html>`

describe('html document utilities', () => {
  it('adds selectable paths using parser-roundtrippable source paths', () => {
    const rendered = addRuntimeAttributes(source)

    expect(rendered).toContain('data-hdv-path="0.1.0"')
    expect(rendered).toContain('data-hdv-label="Cover"')
    expect(rendered).toContain('data-hdv-source-selector="data-component=Cover"')
    expect(rendered).toContain('data-hdv-path="0.1.0.0"')
  })

  it('patches inline styles, attributes, and text without serializing the whole file', () => {
    const edited = applyDocumentEdits(source, {
      elementEdits: [
        {
          targetPath: '0.1.0.0',
          styles: { color: '#123456', 'font-size': '42px' },
          attributes: { 'data-component': 'Headline' },
          textContent: 'Updated',
        },
      ],
    })

    expect(edited).toContain('<h1 class="title"')
    expect(edited).toContain('style="color: #123456; font-size: 42px"')
    expect(edited).toContain('data-component="Headline"')
    expect(edited).toContain('>Updated</h1>')
    expect(edited).toContain('<main data-component="Cover">')
  })

  it('stores and reads document-level page settings', () => {
    const settings: DocumentSettings = {
      pageSizePreset: 'Letter',
      orientation: 'landscape',
      width: '11in',
      height: '8.5in',
      marginTop: '1in',
      marginRight: '0.75in',
      marginBottom: '1in',
      marginLeft: '0.75in',
      backgroundColor: '#f7f7f7',
    }
    const edited = upsertDocumentSettings(source, settings)

    expect(edited).toContain('data-hdv-document-settings')
    expect(edited).toContain('size: 11in 8.5in;')
    expect(readDocumentSettings(edited)).toEqual(settings)
  })

  it('inserts templates around selected source elements', () => {
    const edited = insertTemplateHtml(source, {
      targetPath: '0.1.0.1',
      placement: 'after',
      html: '<aside data-component="Note">Reusable</aside>',
    })

    expect(edited).toContain('<p>Lead</p>\n<aside data-component="Note">Reusable</aside>')
  })

  it('reads and upserts global style blocks', () => {
    const htmlWithStyle = `<!doctype html>
<html>
<head>
  <style>
    body { background: blue; }
  </style>
</head>
<body>
</body>
</html>`
    
    expect(readGlobalStyle(htmlWithStyle).trim()).toBe('body { background: blue; }')
    
    const updated = upsertGlobalStyle(htmlWithStyle, 'body { background: red; }')
    expect(updated).toContain('body { background: red; }')
    expect(updated).not.toContain('body { background: blue; }')
    expect(readGlobalStyle(updated).trim()).toBe('body { background: red; }')
  })

  it('locates elements by selector first and falls back to path', () => {
    const testHtml = `<!doctype html>
<html>
<body>
  <div data-hdv-id="header-block">Original Text</div>
  <p>Some Paragraph</p>
</body>
</html>`

    const edited = applyDocumentEdits(testHtml, {
      elementEdits: [
        {
          targetPath: '0.1.1',
          selector: 'data-hdv-id=header-block',
          textContent: 'Updated Text',
        }
      ]
    })
    
    expect(edited).toContain('<div data-hdv-id="header-block">Updated Text</div>')
    expect(edited).toContain('<p>Some Paragraph</p>')
  })
})

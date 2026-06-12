import { describe, expect, it } from 'vitest'
import { buildAgentReference, cleanTemplateClone, collectSelectionItem, getElementLabel } from './selection'

describe('selection helpers', () => {
  it('prefers human component labels before inferred names', () => {
    document.body.innerHTML = '<section data-component="Hero Block" id="fallback"><h1>Title</h1></section>'
    const element = document.querySelector('section')

    expect(element && getElementLabel(element)).toBe('Hero Block')
  })

  it('removes runtime selection attributes from template clones', () => {
    document.body.innerHTML = '<section data-hdv-path="0.1.0" data-hdv-agent-ref="HDV_REF file=&quot;a.html&quot;" class="hdv-selected"><p data-hdv-label="Text">Copy</p></section>'
    const element = document.querySelector('section')
    const clone = element && cleanTemplateClone(element)

    expect(clone?.outerHTML).toBe('<section class=""><p>Copy</p></section>')
  })

  it('builds copyable references that point agents to the source file and html path', () => {
    document.body.innerHTML =
      '<main data-component="Cover page" data-hdv-path="0.1.0" data-hdv-id="cover-page"><h1>Title</h1></main>'
    const element = document.querySelector('main')

    expect(element && buildAgentReference(element, 'reports/brief.html')).toBe(
      'HDV_REF file="reports/brief.html" path="0.1.0" tag="main" id="cover-page" component="Cover page"',
    )
  })

  it('collects both human labels and agent references for selected elements', () => {
    document.body.innerHTML = '<button data-name="Primary CTA" data-hdv-path="0.1.2">Save</button>'
    const element = document.querySelector('button')
    const item = element && collectSelectionItem(element, window, 'docs/app.html')

    expect(item?.label).toBe('Primary CTA')
    expect(item?.agentReference).toBe('HDV_REF file="docs/app.html" path="0.1.2" tag="button" name="Primary CTA"')
  })
})

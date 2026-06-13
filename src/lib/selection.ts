import type { ElementProperties, SelectionItem } from '../types'

export function getElementLabel(element: Element) {
  const explicit =
    element.getAttribute('data-component') ||
    element.getAttribute('data-name') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('id') ||
    element.getAttribute('data-hdv-label')
  if (explicit?.trim()) {
    return explicit.trim()
  }

  const classes = Array.from(element.classList)
    .filter((className) => !className.startsWith('hdv-'))
    .slice(0, 2)
  const className = classes.length ? `.${classes.join('.')}` : ''
  const text = element.textContent?.replace(/\s+/g, ' ').trim()
  const textSuffix = text ? ` "${text.slice(0, 32)}${text.length > 32 ? '...' : ''}"` : ''
  return `${element.tagName.toLowerCase()}${className}${textSuffix}`
}

export function collectSelectionItem(element: Element, frameWindow: Window, documentPathOverride = ''): SelectionItem {
  const path = element.getAttribute('data-hdv-path') || ''
  const label = getElementLabel(element)
  const documentPath = documentPathOverride || frameWindow.frameElement?.getAttribute('data-document-path') || ''
  const selector = element.getAttribute('data-hdv-source-selector') || undefined
  return {
    path,
    label,
    agentReference: buildAgentReference(element, documentPath),
    tag: element.tagName.toLowerCase(),
    properties: readElementProperties(element, frameWindow, label, path),
    selector,
  }
}

export function buildAgentReference(element: Element, documentPath: string) {
  const pairs: Array<[string, string | null]> = [
    ['file', documentPath || element.ownerDocument?.documentElement.getAttribute('data-hdv-document-path') || ''],
    ['path', element.getAttribute('data-hdv-path')],
    ['tag', element.tagName.toLowerCase()],
    ['id', element.getAttribute('data-hdv-id') || element.getAttribute('id')],
    ['component', element.getAttribute('data-component')],
    ['name', element.getAttribute('data-name')],
    ['selector', element.getAttribute('data-hdv-source-selector')],
  ]
  const parts = pairs
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `${key}="${escapeReferenceValue(value || '')}"`)
  return `HDV_REF ${parts.join(' ')}`
}

export function readElementProperties(element: Element, frameWindow: Window, label = getElementLabel(element), path = ''): ElementProperties {
  const style = frameWindow.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  const page = element.closest('.pagedjs_page')
  const pageRect = page?.getBoundingClientRect()

  return {
    path,
    label,
    tag: element.tagName.toLowerCase(),
    text: element.textContent?.replace(/\s+/g, ' ').trim() || '',
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    color: style.color,
    backgroundColor: style.backgroundColor,
    width: `${Math.round(rect.width)}px`,
    height: `${Math.round(rect.height)}px`,
    pageX: pageRect ? `${Math.round(rect.left - pageRect.left)}px` : `${Math.round(rect.left)}px`,
    pageY: pageRect ? `${Math.round(rect.top - pageRect.top)}px` : `${Math.round(rect.top)}px`,
    documentX: `${Math.round(rect.left + frameWindow.scrollX)}px`,
    documentY: `${Math.round(rect.top + frameWindow.scrollY)}px`,
    margin: `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`,
    padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
    opacity: style.opacity,
    border: `${style.borderWidth} ${style.borderStyle} ${style.borderColor}`,
    transform: style.transform === 'none' ? '' : style.transform,
    position: style.position,
    id: element.getAttribute('id') || '',
    hdvId: element.getAttribute('data-hdv-id') || '',
    class: element.getAttribute('class') || '',
    src: element.tagName.toLowerCase() === 'img' ? element.getAttribute('src') || '' : '',
  }
}

export function cleanTemplateClone(element: Element) {
  const clone = element.cloneNode(true) as Element
  for (const node of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
    node.removeAttribute('data-hdv-path')
    node.removeAttribute('data-hdv-label')
    node.removeAttribute('data-hdv-agent-ref')
    node.removeAttribute('data-hdv-source-selector')
    node.classList.remove('hdv-hover', 'hdv-selected')
  }
  return clone
}

function escapeReferenceValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function inlineComputedStyles(source: Element, clone: Element, frameWindow: Window) {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll('*'))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))]
  sourceNodes.forEach((sourceNode, index) => {
    const targetNode = cloneNodes[index] as HTMLElement | undefined
    if (!targetNode) {
      return
    }
    const style = frameWindow.getComputedStyle(sourceNode)
    const picked = [
      'display',
      'position',
      'box-sizing',
      'width',
      'min-width',
      'max-width',
      'height',
      'min-height',
      'max-height',
      'margin',
      'padding',
      'font',
      'font-size',
      'font-weight',
      'line-height',
      'color',
      'background',
      'border',
      'border-radius',
      'opacity',
      'transform',
      'text-align',
      'letter-spacing',
    ]
    targetNode.setAttribute('style', picked.map((name) => `${name}: ${style.getPropertyValue(name)}`).join('; '))
  })
}

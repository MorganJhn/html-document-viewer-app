import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5'
import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from '../shared/document-settings'
import { escapeAttribute, escapeText } from '../shared/escape'

type AnyNode = DefaultTreeAdapterMap['node']
type ElementNode = DefaultTreeAdapterMap['element']
type DocumentNode = DefaultTreeAdapterMap['document']
type LocationNode = ElementNode & {
  sourceCodeLocation?: {
    startOffset: number
    endOffset: number
    startTag?: {
      startOffset: number
      endOffset: number
      attrs?: Record<string, { startOffset: number; endOffset: number }>
    }
    endTag?: {
      startOffset: number
      endOffset: number
    }
    attrs?: Record<string, { startOffset: number; endOffset: number }>
  }
}

export interface ElementEdit {
  targetPath: string
  selector?: string
  styles?: Record<string, string | null>
  attributes?: Record<string, string | null>
  textContent?: string
}

export interface ApplyEditsInput {
  elementEdits?: ElementEdit[]
  documentSettings?: DocumentSettings
  globalStyle?: string
}

export interface InsertTemplateInput {
  targetPath: string
  placement: 'before' | 'after' | 'inside-start' | 'inside-end'
  html: string
}

const SETTINGS_SELECTOR = /<style\b(?=[^>]*\bdata-hdv-document-settings\b)[^>]*>[\s\S]*?<\/style>/i
const SETTINGS_JSON = /hdv-settings:({[\s\S]*?})\s*\*\//

export function readDocumentSettings(html: string): DocumentSettings {
  const match = html.match(SETTINGS_SELECTOR)
  if (!match) {
    return { ...DEFAULT_DOCUMENT_SETTINGS }
  }

  const settingsMatch = match[0].match(SETTINGS_JSON)
  if (!settingsMatch) {
    return { ...DEFAULT_DOCUMENT_SETTINGS }
  }

  try {
    return normalizeSettings(JSON.parse(settingsMatch[1]) as Partial<DocumentSettings>)
  } catch {
    return { ...DEFAULT_DOCUMENT_SETTINGS }
  }
}

export function buildDocumentSettingsStyle(settings: DocumentSettings, attribute = 'data-hdv-document-settings') {
  const normalized = normalizeSettings(settings)
  const pageSize = `${normalized.width} ${normalized.height}`
  const margins = `${normalized.marginTop} ${normalized.marginRight} ${normalized.marginBottom} ${normalized.marginLeft}`

  return `<style ${attribute}>
/* hdv-settings:${JSON.stringify(normalized)} */
@page {
  size: ${pageSize};
  margin: ${margins};
}
html,
body {
  background: ${normalized.backgroundColor};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.pagedjs_page {
  background: ${normalized.backgroundColor};
}
</style>`
}

export function upsertDocumentSettings(html: string, settings: DocumentSettings) {
  const style = buildDocumentSettingsStyle(settings)
  if (SETTINGS_SELECTOR.test(html)) {
    return html.replace(SETTINGS_SELECTOR, style)
  }

  return injectIntoHead(html, style)
}

export function renderDocumentMarkup(html: string, documentId: string, options: { exportBaseHref?: string; isSlideDeck?: boolean; previewMode?: boolean } = {}) {
  const settings = readDocumentSettings(html)
  const marked = addRuntimeAttributes(html)
  const baseHref = options.exportBaseHref ?? `/api/documents/${encodeURIComponent(documentId)}/assets/`
  
  const head = [
    `<base data-hdv-base href="${escapeAttribute(baseHref)}">`,
    buildDocumentSettingsStyle(settings, 'data-hdv-preview-settings'),
  ]
  if (options.previewMode) {
    head.push(`<link rel="stylesheet" href="/viewer/render.css">`)
  }
  if (!options.isSlideDeck) {
    if (options.previewMode) {
      head.push(`<script>window.PagedConfig = { auto: false };</script>`)
    }
    head.push(`<script src="/vendor/paged.polyfill.js"></script>`)
  }

  return injectIntoHead(marked, head.join('\n'))
}

export function applyDocumentEdits(html: string, input: ApplyEditsInput) {
  let nextHtml = html
  const patches: Array<{ start: number; end: number; value: string }> = []

  if (input.elementEdits?.length) {
    const document = parse(html, { sourceCodeLocationInfo: true }) as DocumentNode
    for (const edit of input.elementEdits) {
      let element = edit.selector ? findElementBySelector(document, edit.selector) : undefined
      if (!element) {
        element = findElementByPath(document, edit.targetPath)
      }
      if (!element) {
        throw Object.assign(new Error(`Element not found for path ${edit.targetPath}.`), { statusCode: 400 })
      }

      if (edit.styles) {
        const currentStyle = getAttribute(element, 'style') || ''
        const mergedStyle = mergeInlineStyles(currentStyle, edit.styles)
        queueAttributePatch(html, patches, element, 'style', mergedStyle)
      }

      if (edit.attributes) {
        for (const [name, value] of Object.entries(edit.attributes)) {
          queueAttributePatch(html, patches, element, name, value)
        }
      }

      if (typeof edit.textContent === 'string') {
        queueTextPatch(patches, element, edit.textContent)
      }
    }

    nextHtml = applyPatches(html, patches)
  }

  if (input.documentSettings) {
    nextHtml = upsertDocumentSettings(nextHtml, input.documentSettings)
  }

  if (typeof input.globalStyle === 'string') {
    nextHtml = upsertGlobalStyle(nextHtml, input.globalStyle)
  }

  return nextHtml
}

export function insertTemplateHtml(html: string, input: InsertTemplateInput) {
  const document = parse(html, { sourceCodeLocationInfo: true }) as DocumentNode
  const target = findElementByPath(document, input.targetPath)
  if (!target) {
    throw Object.assign(new Error(`Element not found for path ${input.targetPath}.`), { statusCode: 400 })
  }

  const location = getLocation(target)
  if (!location) {
    throw Object.assign(new Error('Cannot insert into an element without source location.'), { statusCode: 400 })
  }

  let offset: number
  if (input.placement === 'before') {
    offset = location.startOffset
  } else if (input.placement === 'after') {
    offset = location.endOffset
  } else if (input.placement === 'inside-start') {
    offset = location.startTag?.endOffset ?? location.startOffset
  } else {
    offset = location.endTag?.startOffset ?? location.endOffset
  }

  return `${html.slice(0, offset)}\n${input.html}\n${html.slice(offset)}`
}

export function addRuntimeAttributes(html: string) {
  const document = parse(html) as DocumentNode
  for (const child of childElements(document)) {
    annotateRuntimeTree(child, getElementPath(document, child))
  }
  return serialize(document)
}

function annotateRuntimeTree(element: ElementNode, path: string) {
  if (isSelectableElement(element)) {
    setAttribute(element, 'data-hdv-path', path)
    const selector = inferSourceSelector(element)
    if (selector) {
      setAttribute(element, 'data-hdv-source-selector', selector)
    }
    const label = inferNodeLabel(element)
    if (label) {
      setAttribute(element, 'data-hdv-label', label)
    }
  }

  for (const child of childElements(element)) {
    const childIndex = childElements(element).indexOf(child)
    annotateRuntimeTree(child, `${path}.${childIndex}`)
  }
}

function inferNodeLabel(element: ElementNode) {
  const explicit =
    getAttribute(element, 'data-component') ||
    getAttribute(element, 'data-name') ||
    getAttribute(element, 'aria-label') ||
    getAttribute(element, 'id')
  if (explicit?.trim()) {
    return explicit.trim()
  }

  const classAttr = getAttribute(element, 'class')
  const classes = classAttr
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('.')
  return `${element.tagName}${classes ? `.${classes}` : ''}`
}

function inferSourceSelector(element: ElementNode) {
  const stableId = getAttribute(element, 'data-hdv-id')
  if (stableId?.trim()) {
    return `data-hdv-id=${stableId.trim()}`
  }
  const component = getAttribute(element, 'data-component')
  if (component?.trim()) {
    return `data-component=${component.trim()}`
  }
  const name = getAttribute(element, 'data-name')
  if (name?.trim()) {
    return `data-name=${name.trim()}`
  }
  const id = getAttribute(element, 'id')
  if (id?.trim()) {
    return `id=${id.trim()}`
  }
  return undefined
}

function getElementPath(parent: AnyNode, child: ElementNode) {
  const siblings = childElements(parent)
  const index = siblings.indexOf(child)
  const parentPath = isElement(parent) ? getAttribute(parent, 'data-hdv-path') : ''
  return parentPath ? `${parentPath}.${index}` : `${index}`
}

function findElementBySelector(node: AnyNode, selector: string): ElementNode | undefined {
  const eqIdx = selector.indexOf('=')
  if (eqIdx !== -1) {
    const attrName = selector.substring(0, eqIdx).trim()
    const attrVal = selector.substring(eqIdx + 1).trim()
    if (isElement(node) && getAttribute(node, attrName) === attrVal) {
      return node
    }
  }

  for (const child of getChildNodes(node)) {
    const found = findElementBySelector(child, selector)
    if (found) {
      return found
    }
  }
  return undefined
}

function findElementByPath(document: DocumentNode, sourcePath: string) {
  const parts = sourcePath
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part))

  let current: AnyNode = document
  for (const part of parts) {
    const elements = childElements(current)
    const next = elements[part]
    if (!next) {
      return undefined
    }
    current = next
  }

  return isElement(current) ? current : undefined
}

function childElements(node: AnyNode) {
  return getChildNodes(node).filter(isElement)
}

function getChildNodes(node: AnyNode) {
  return 'childNodes' in node && Array.isArray(node.childNodes) ? node.childNodes : []
}

function isElement(node: AnyNode): node is ElementNode {
  return 'tagName' in node && Array.isArray(node.attrs)
}

function isSelectableElement(element: ElementNode) {
  return !['html', 'head', 'base', 'link', 'meta', 'script', 'style', 'title'].includes(element.tagName)
}

function setAttribute(element: ElementNode, name: string, value: string) {
  const existing = element.attrs.find((attr) => attr.name === name)
  if (existing) {
    existing.value = value
  } else {
    element.attrs.push({ name, value })
  }
}

function getAttribute(element: ElementNode, name: string) {
  return element.attrs.find((attr) => attr.name === name)?.value
}

function queueAttributePatch(
  html: string,
  patches: Array<{ start: number; end: number; value: string }>,
  element: ElementNode,
  name: string,
  value: string | null,
) {
  const location = getLocation(element)
  if (!location?.startTag) {
    throw Object.assign(new Error('Cannot patch an element without a start tag.'), { statusCode: 400 })
  }

  const attrLocation = location.startTag.attrs?.[name] ?? location.attrs?.[name]
  if (attrLocation) {
    patches.push({
      start: attrLocation.startOffset,
      end: attrLocation.endOffset,
      value: value === null ? '' : `${name}="${escapeAttribute(value)}"`,
    })
    return
  }

  if (value === null) {
    return
  }

  const startTag = html.slice(location.startTag.startOffset, location.startTag.endOffset)
  const closeOffset = startTag.lastIndexOf('>')
  let insertOffset = location.startTag.startOffset + closeOffset
  if (html[insertOffset - 1] === '/') {
    insertOffset -= 1
  }

  patches.push({
    start: insertOffset,
    end: insertOffset,
    value: ` ${name}="${escapeAttribute(value)}"`,
  })
}

function queueTextPatch(patches: Array<{ start: number; end: number; value: string }>, element: ElementNode, text: string) {
  const location = getLocation(element)
  if (!location?.startTag?.endOffset || !location.endTag?.startOffset) {
    throw Object.assign(new Error('Cannot patch text for this element.'), { statusCode: 400 })
  }

  patches.push({
    start: location.startTag.endOffset,
    end: location.endTag.startOffset,
    value: escapeText(text),
  })
}

function applyPatches(html: string, patches: Array<{ start: number; end: number; value: string }>) {
  const sorted = [...patches].sort((a, b) => b.start - a.start)
  let nextHtml = html
  for (const patch of sorted) {
    nextHtml = `${nextHtml.slice(0, patch.start)}${patch.value}${nextHtml.slice(patch.end)}`
  }
  return nextHtml
}

function getLocation(element: ElementNode) {
  return (element as LocationNode).sourceCodeLocation
}

function mergeInlineStyles(current: string, updates: Record<string, string | null>) {
  const map = new Map<string, string>()
  for (const declaration of current.split(';')) {
    const [rawName, ...rawValue] = declaration.split(':')
    const name = rawName?.trim()
    const value = rawValue.join(':').trim()
    if (name && value) {
      map.set(name, value)
    }
  }

  for (const [name, value] of Object.entries(updates)) {
    if (!name.trim()) {
      continue
    }
    if (value === null || value === '') {
      map.delete(name)
    } else {
      map.set(name.trim(), value.trim())
    }
  }

  return [...map.entries()].map(([name, value]) => `${name}: ${value}`).join('; ')
}

function injectIntoHead(html: string, markup: string) {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${markup}\n</head>`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}\n<head>${markup}</head>`)
  }
  return `<head>${markup}</head>\n${html}`
}

function normalizeSettings(settings: Partial<DocumentSettings>): DocumentSettings {
  const preset = ['A4', 'Letter', 'Legal', 'Slide16_9', 'Custom'].includes(settings.pageSizePreset || '')
    ? (settings.pageSizePreset as DocumentSettings['pageSizePreset'])
    : DEFAULT_DOCUMENT_SETTINGS.pageSizePreset
  const orientation = settings.orientation === 'landscape' ? 'landscape' : 'portrait'

  let width = settings.width || DEFAULT_DOCUMENT_SETTINGS.width
  let height = settings.height || DEFAULT_DOCUMENT_SETTINGS.height

  if (preset === 'A4') {
    width = orientation === 'landscape' ? '297mm' : '210mm'
    height = orientation === 'landscape' ? '210mm' : '297mm'
  } else if (preset === 'Letter') {
    width = orientation === 'landscape' ? '11in' : '8.5in'
    height = orientation === 'landscape' ? '8.5in' : '11in'
  } else if (preset === 'Legal') {
    width = orientation === 'landscape' ? '14in' : '8.5in'
    height = orientation === 'landscape' ? '8.5in' : '14in'
  } else if (preset === 'Slide16_9') {
    width = '297mm'
    height = '167mm'
  }

  return {
    ...DEFAULT_DOCUMENT_SETTINGS,
    ...settings,
    pageSizePreset: preset,
    orientation,
    width,
    height,
  }
}

function findMainStyleElement(node: AnyNode): ElementNode | undefined {
  if (isElement(node) && node.tagName === 'style' && getAttribute(node, 'data-hdv-document-settings') === undefined) {
    return node
  }
  for (const child of getChildNodes(node)) {
    const found = findMainStyleElement(child)
    if (found) {
      return found
    }
  }
  return undefined
}

function findElementByName(node: AnyNode, name: string): ElementNode | undefined {
  if (isElement(node) && node.tagName === name) {
    return node
  }
  for (const child of getChildNodes(node)) {
    const found = findElementByName(child, name)
    if (found) {
      return found
    }
  }
  return undefined
}

function getElementTextContent(element: ElementNode): string {
  const textNode = element.childNodes.find((child) => child.nodeName === '#text') as { value: string } | undefined
  return textNode ? textNode.value : ''
}

export function readGlobalStyle(html: string): string {
  try {
    const doc = parse(html) as DocumentNode
    const styleEl = findMainStyleElement(doc)
    if (styleEl) {
      return getElementTextContent(styleEl)
    }
  } catch (err) {
    console.error('Error reading global style', err)
  }
  return ''
}

export function upsertGlobalStyle(html: string, globalStyle: string): string {
  const doc = parse(html, { sourceCodeLocationInfo: true }) as DocumentNode
  const styleEl = findMainStyleElement(doc) as LocationNode
  
  if (styleEl && styleEl.sourceCodeLocation) {
    const startTag = styleEl.sourceCodeLocation.startTag
    const endTag = styleEl.sourceCodeLocation.endTag
    if (startTag && endTag) {
      const start = startTag.endOffset
      const end = endTag.startOffset
      return html.substring(0, start) + '\n' + globalStyle + '\n' + html.substring(end)
    }
  }
  
  const headEl = findElementByName(doc, 'head') as LocationNode
  if (headEl && headEl.sourceCodeLocation) {
    const startTag = headEl.sourceCodeLocation.startTag
    if (startTag) {
      const injectOffset = startTag.endOffset
      const styleBlock = `\n  <style>\n${globalStyle}\n  </style>`
      return html.substring(0, injectOffset) + styleBlock + html.substring(injectOffset)
    }
  }
  
  return html.replace('<head>', `<head>\n  <style>\n${globalStyle}\n  </style>`)
}

import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5'

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

export interface DocumentSettings {
  pageSizePreset: 'A4' | 'Letter' | 'Legal' | 'Custom'
  orientation: 'portrait' | 'landscape'
  width: string
  height: string
  marginTop: string
  marginRight: string
  marginBottom: string
  marginLeft: string
  backgroundColor: string
}

export interface ElementEdit {
  targetPath: string
  styles?: Record<string, string | null>
  attributes?: Record<string, string | null>
  textContent?: string
}

export interface ApplyEditsInput {
  elementEdits?: ElementEdit[]
  documentSettings?: DocumentSettings
}

export interface InsertTemplateInput {
  targetPath: string
  placement: 'before' | 'after' | 'inside-start' | 'inside-end'
  html: string
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  pageSizePreset: 'A4',
  orientation: 'portrait',
  width: '210mm',
  height: '297mm',
  marginTop: '20mm',
  marginRight: '20mm',
  marginBottom: '20mm',
  marginLeft: '20mm',
  backgroundColor: '#ffffff',
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
  const pageSize =
    normalized.pageSizePreset === 'Custom'
      ? `${normalized.width} ${normalized.height}`
      : `${normalized.pageSizePreset} ${normalized.orientation}`
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

export function renderDocumentMarkup(html: string, documentId: string, options: { exportBaseHref?: string } = {}) {
  const settings = readDocumentSettings(html)
  const marked = addRuntimeAttributes(html)
  const baseHref = options.exportBaseHref ?? `/api/documents/${encodeURIComponent(documentId)}/assets/`
  const head = [
    `<base data-hdv-base href="${escapeAttribute(baseHref)}">`,
    buildDocumentSettingsStyle(settings, 'data-hdv-preview-settings'),
    `<link rel="stylesheet" href="/viewer/render.css">`,
    `<script src="/vendor/paged.polyfill.js"></script>`,
  ].join('\n')

  return injectIntoHead(marked, head)
}

export function applyDocumentEdits(html: string, input: ApplyEditsInput) {
  let nextHtml = html
  const patches: Array<{ start: number; end: number; value: string }> = []

  if (input.elementEdits?.length) {
    const document = parse(html, { sourceCodeLocationInfo: true }) as DocumentNode
    for (const edit of input.elementEdits) {
      const element = findElementByPath(document, edit.targetPath)
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
    value: escapeHtml(text),
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
  return {
    ...DEFAULT_DOCUMENT_SETTINGS,
    ...settings,
    pageSizePreset: ['A4', 'Letter', 'Legal', 'Custom'].includes(settings.pageSizePreset || '')
      ? (settings.pageSizePreset as DocumentSettings['pageSizePreset'])
      : DEFAULT_DOCUMENT_SETTINGS.pageSizePreset,
    orientation: settings.orientation === 'landscape' ? 'landscape' : 'portrait',
  }
}

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

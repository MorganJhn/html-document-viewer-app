import fs from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'
import { ensureWorkspace } from './paths'
import { escapeAttribute } from '../shared/escape'

export interface TemplateRecord {
  id: string
  name: string
  html: string
  sourceDocumentId?: string
  sourceDocumentPath?: string
  previewText: string
  createdAt: string
  updatedAt: string
}

export async function listTemplates(rootPath: string): Promise<TemplateRecord[]> {
  const folders = await ensureWorkspace(rootPath)
  const entries = await fs.readdir(folders.templates, { withFileTypes: true })
  const templates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => {
        const raw = await fs.readFile(path.join(folders.templates, entry.name), 'utf8')
        return JSON.parse(raw) as TemplateRecord
      }),
  )
  return templates.map(normalizeTemplate).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveTemplate(
  rootPath: string,
  input: { name: string; html: string; sourceDocumentId?: string; sourceDocumentPath?: string },
) {
  const folders = await ensureWorkspace(rootPath)
  const now = new Date().toISOString()
  const name = input.name.trim() || 'Untitled block'
  const html = annotateTemplateRoot(input.html, name)
  const template: TemplateRecord = {
    id: nanoid(10),
    name,
    html,
    sourceDocumentId: input.sourceDocumentId,
    sourceDocumentPath: input.sourceDocumentPath,
    previewText: extractPreviewText(html),
    createdAt: now,
    updatedAt: now,
  }
  await fs.writeFile(path.join(folders.templates, `${template.id}.json`), `${JSON.stringify(template, null, 2)}\n`, 'utf8')
  return template
}

export async function getTemplate(rootPath: string, templateId: string) {
  const folders = await ensureWorkspace(rootPath)
  const templatePath = path.join(folders.templates, `${templateId}.json`)
  const raw = await fs.readFile(templatePath, 'utf8')
  return normalizeTemplate(JSON.parse(raw) as Partial<TemplateRecord>)
}

export async function updateTemplate(rootPath: string, templateId: string, input: { name?: string }) {
  const folders = await ensureWorkspace(rootPath)
  const templatePath = path.join(folders.templates, `${templateId}.json`)
  const existing = await getTemplate(rootPath, templateId)
  const updated: TemplateRecord = {
    ...existing,
    name: input.name?.trim() || existing.name,
    updatedAt: new Date().toISOString(),
  }
  await fs.writeFile(templatePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
  return updated
}

export async function deleteTemplate(rootPath: string, templateId: string) {
  const folders = await ensureWorkspace(rootPath)
  await fs.rm(path.join(folders.templates, `${templateId}.json`), { force: true })
}

function normalizeTemplate(template: Partial<TemplateRecord>): TemplateRecord {
  const createdAt = template.createdAt || new Date(0).toISOString()
  return {
    id: template.id || '',
    name: template.name || 'Untitled block',
    html: template.html || '',
    sourceDocumentId: template.sourceDocumentId,
    sourceDocumentPath: template.sourceDocumentPath,
    previewText: template.previewText || extractPreviewText(template.html || ''),
    createdAt,
    updatedAt: template.updatedAt || createdAt,
  }
}

function extractPreviewText(html: string) {
  const fragment = parseFragment(html)
  const text = collectText(fragment)
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 160)
}

function annotateTemplateRoot(html: string, name: string) {
  const escapedName = escapeAttribute(name)
  return html.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/, (_match, tagName: string, attrs: string) => {
    if (/\sdata-component\s*=/.test(attrs)) {
      return `<${tagName}${attrs.replace(/\sdata-component\s*=\s*(".*?"|'.*?'|[^\s>]+)/, ` data-component="${escapedName}"`)}>`
    }
    return `<${tagName} data-component="${escapedName}"${attrs}>`
  })
}

function collectText(node: DefaultTreeAdapterMap['node']): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value
  }
  if ('childNodes' in node && Array.isArray(node.childNodes)) {
    return node.childNodes.map(collectText).join(' ')
  }
  return ''
}

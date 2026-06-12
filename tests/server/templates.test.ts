import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteTemplate, listTemplates, saveTemplate, updateTemplate } from '../../server/templates'

let tempDir = ''

describe('component library templates', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hdv-templates-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('stores reusable component metadata for cross-document use', async () => {
    const template = await saveTemplate(tempDir, {
      name: 'Review callout',
      html: '<aside data-component="Review callout"><strong>Check this</strong></aside>',
      sourceDocumentId: 'doc-a',
      sourceDocumentPath: 'reports/source.html',
    })

    expect(template.previewText).toBe('Check this')
    expect(template.sourceDocumentPath).toBe('reports/source.html')
    expect(template.html).toContain('data-component="Review callout"')

    const renamed = await updateTemplate(tempDir, template.id, { name: 'Reusable callout' })
    expect(renamed.name).toBe('Reusable callout')
    expect(renamed.updatedAt).not.toBe(template.updatedAt)

    const templates = await listTemplates(tempDir)
    expect(templates).toMatchObject([{ id: template.id, name: 'Reusable callout', sourceDocumentPath: 'reports/source.html' }])

    await deleteTemplate(tempDir, template.id)
    await expect(listTemplates(tempDir)).resolves.toEqual([])
  })
})

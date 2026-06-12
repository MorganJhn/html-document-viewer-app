import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup, encodeDocumentId, isPathInside, listDocuments, resolveDocument } from '../../server/paths'

let tempDir = ''

describe('workspace path utilities', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hdv-paths-'))
    await fs.mkdir(path.join(tempDir, 'nested'), { recursive: true })
    await fs.mkdir(path.join(tempDir, '_hdv'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'index.html'), '<html></html>', 'utf8')
    await fs.writeFile(path.join(tempDir, 'nested', 'page.htm'), '<html></html>', 'utf8')
    await fs.writeFile(path.join(tempDir, '_hdv', 'ignored.html'), '<html></html>', 'utf8')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('detects HTML documents and ignores internal app folders', async () => {
    const documents = await listDocuments(tempDir)

    expect(documents.map((document) => document.relativePath)).toEqual(['index.html', 'nested/page.htm'])
  })

  it('keeps resolved documents inside the workspace', async () => {
    const id = encodeDocumentId(path.join('nested', 'page.htm'))

    await expect(resolveDocument(tempDir, id)).resolves.toBe(path.join(tempDir, 'nested', 'page.htm'))
    expect(isPathInside(tempDir, path.join(tempDir, 'nested', 'page.htm'))).toBe(true)
    expect(isPathInside(tempDir, path.dirname(tempDir))).toBe(false)
  })

  it('creates backups under the workspace internal folder', async () => {
    const backup = await createBackup(tempDir, path.join(tempDir, 'index.html'))

    expect(backup).toContain(path.join(tempDir, '_hdv', 'backups'))
    await expect(fs.readFile(backup, 'utf8')).resolves.toBe('<html></html>')
  })
})

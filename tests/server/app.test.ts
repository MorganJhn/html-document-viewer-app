import fs from 'node:fs/promises'
import path from 'node:path'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../server/app'

describe('write token gate', () => {
  const previousToken = process.env.HDV_TOKEN

  afterEach(() => {
    process.env.HDV_TOKEN = previousToken
  })

  it('allows localhost writes without a token for local review sessions', async () => {
    const app = createApp()
    const response = await request(app).post('/api/workspace').set('Host', '127.0.0.1').send({ workspacePath: './workspace' })

    expect(response.status).toBe(200)
  })

  it('blocks public-host writes unless the configured token is sent', async () => {
    process.env.HDV_TOKEN = 'secret'
    const app = createApp()

    await request(app).post('/api/workspace').set('Host', 'viewer.example.test').send({ workspacePath: './workspace' }).expect(401)
    await request(app)
      .post('/api/workspace')
      .set('Host', 'viewer.example.test')
      .set('x-hdv-token', 'secret')
      .send({ workspacePath: './workspace' })
      .expect(200)
  })
})

describe('POST /api/documents', () => {
  it('creates a new document in the workspace', async () => {
    const app = createApp()
    const testName = `test-created-${Date.now()}.html`
    const response = await request(app)
      .post('/api/documents')
      .set('Host', '127.0.0.1')
      .send({ name: testName })

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(response.body.document.name).toBe(testName)
    
    // Clean up created file
    const workspacePath = path.resolve('./workspace', testName)
    await fs.unlink(workspacePath).catch(() => {})
  })

  it('returns 400 if name is empty', async () => {
    const app = createApp()
    const response = await request(app)
      .post('/api/documents')
      .set('Host', '127.0.0.1')
      .send({ name: '' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('INVALID_NAME')
  })

  it('returns 403 if path is outside workspace', async () => {
    const app = createApp()
    const response = await request(app)
      .post('/api/documents')
      .set('Host', '127.0.0.1')
      .send({ name: '../outside.html' })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('PATH_OUTSIDE_WORKSPACE')
  })
})

describe('GET /api/exports/download', () => {
  it('downloads the file if inside the exports directory', async () => {
    const app = createApp()
    const testFile = path.resolve('./workspace/_hdv/exports/test-download.pdf')
    await fs.mkdir(path.dirname(testFile), { recursive: true })
    await fs.writeFile(testFile, 'PDF-content', 'utf8')

    const response = await request(app)
      .get(`/api/exports/download?filename=test-download.pdf`)
      .set('Host', '127.0.0.1')

    expect(response.status).toBe(200)
    expect(response.headers['content-disposition']).toContain('attachment; filename="test-download.pdf"')
    expect(response.body.toString('utf8')).toBe('PDF-content')

    await fs.unlink(testFile).catch(() => {})
  })

  it('returns 403 if trying to download a file outside exports directory via path traversal', async () => {
    const app = createApp()

    const response = await request(app)
      .get(`/api/exports/download?filename=../test-outside.pdf`)
      .set('Host', '127.0.0.1')

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('ACCESS_DENIED')
  })
})


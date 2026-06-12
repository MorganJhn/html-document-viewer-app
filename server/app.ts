import fs from 'node:fs/promises'
import path from 'node:path'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import mime from 'mime-types'
import {
  createBackup,
  defaultWorkspacePath,
  encodeDocumentId,
  ensureWorkspace,
  getFsRoots,
  isPathInside,
  listDirectoryChildren,
  listDocuments,
  readConfig,
  resolveDocument,
  writeConfig,
} from './paths'
import {
  DEFAULT_DOCUMENT_SETTINGS,
  applyDocumentEdits,
  insertTemplateHtml,
  readDocumentSettings,
  renderDocumentMarkup,
  upsertDocumentSettings,
} from './html'
import { exportPdf, exportViewableHtml } from './exporter'
import { deleteTemplate, getTemplate, listTemplates, saveTemplate, updateTemplate } from './templates'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors())
  app.use(express.json({ limit: '25mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/vendor/paged.polyfill.js', async (_req, res, next) => {
    try {
      res.type('application/javascript')
      res.sendFile(path.join(process.cwd(), 'node_modules', 'pagedjs', 'dist', 'paged.polyfill.js'))
    } catch (error) {
      next(error)
    }
  })

  app.get('/viewer/render.css', (_req, res) => {
    res.type('text/css').send(renderCss)
  })

  app.get('/api/workspace', async (_req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const folders = await ensureWorkspace(config.workspacePath)
      res.json({ workspacePath: folders.root, internalPath: folders.internal })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/workspace', requireWriteToken, async (req, res, next) => {
    try {
      const requestedPath = String(req.body?.workspacePath || defaultWorkspacePath())
      const workspacePath = path.resolve(requestedPath)
      const folders = await ensureWorkspace(workspacePath)
      await writeConfig({ workspacePath: folders.root })
      res.json({ workspacePath: folders.root, internalPath: folders.internal })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/fs/roots', async (_req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      res.json({ roots: await getFsRoots(config.workspacePath) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/fs/children', async (req, res, next) => {
    try {
      const parentPath = String(req.query.path || '')
      res.json({ children: await listDirectoryChildren(parentPath) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/documents', async (_req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      await ensureWorkspace(config.workspacePath)
      res.json({ documents: await listDocuments(config.workspacePath) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/documents', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const name = String(req.body?.name || '').trim()
      if (!name) {
        res.status(400).json({ error: 'INVALID_NAME', message: 'Document name is required.' })
        return
      }

      const fileName = name.endsWith('.html') || name.endsWith('.htm') ? name : `${name}.html`
      const documentPath = path.resolve(config.workspacePath, fileName)

      if (!isPathInside(config.workspacePath, documentPath)) {
        res.status(403).json({ error: 'PATH_OUTSIDE_WORKSPACE', message: 'Document path must be inside the workspace.' })
        return
      }

      try {
        await fs.access(documentPath)
        res.status(400).json({ error: 'DOCUMENT_EXISTS', message: 'A document with this name already exists.' })
        return
      } catch {
        // Document does not exist, safe to create
      }

      const settings = req.body?.settings || DEFAULT_DOCUMENT_SETTINGS

      const initialHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${path.basename(fileName, path.extname(fileName))}</title>
</head>
<body>
  <!-- Document content placeholder -->
</body>
</html>`

      const htmlWithSettings = upsertDocumentSettings(initialHtml, settings)
      await fs.writeFile(documentPath, htmlWithSettings, 'utf8')

      const stat = await fs.stat(documentPath)
      const relativePath = path.relative(config.workspacePath, documentPath).replaceAll(path.sep, '/')

      res.json({
        ok: true,
        document: {
          id: encodeDocumentId(relativePath),
          name: path.basename(documentPath),
          relativePath,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          settings,
        }
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/documents/:id', async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const documentPath = await resolveDocument(config.workspacePath, req.params.id)
      const stat = await fs.stat(documentPath)
      const html = await fs.readFile(documentPath, 'utf8')
      res.json({
        id: req.params.id,
        name: path.basename(documentPath),
        relativePath: path.relative(config.workspacePath, documentPath).replaceAll(path.sep, '/'),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        settings: readDocumentSettings(html),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/documents/:id/render', async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const documentPath = await resolveDocument(config.workspacePath, req.params.id)
      const html = await fs.readFile(documentPath, 'utf8')
      res.type('html').send(renderDocumentMarkup(html, req.params.id))
    } catch (error) {
      next(error)
    }
  })

  app.use('/api/documents/:id/assets', async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const documentPath = await resolveDocument(config.workspacePath, req.params.id)
      const documentDir = path.dirname(documentPath)
      const assetPath = path.resolve(documentDir, decodeURIComponent(req.path.slice(1)))
      if (!isPathInside(documentDir, assetPath)) {
        res.status(403).json({ error: 'ASSET_OUTSIDE_DOCUMENT_DIR' })
        return
      }
      const contentType = mime.lookup(assetPath) || 'application/octet-stream'
      res.type(contentType)
      res.sendFile(assetPath)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/documents/:id/edits', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const documentId = paramValue(req.params.id)
      const documentPath = await resolveDocument(config.workspacePath, documentId)
      const html = await fs.readFile(documentPath, 'utf8')
      const nextHtml = applyDocumentEdits(html, {
        elementEdits: req.body?.elementEdits,
        documentSettings: req.body?.documentSettings,
      })
      const backupPath = await createBackup(config.workspacePath, documentPath)
      await fs.writeFile(documentPath, nextHtml, 'utf8')
      res.json({ ok: true, backupPath })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/documents/:id/export/html', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const documentId = paramValue(req.params.id)
      const documentPath = await resolveDocument(config.workspacePath, documentId)
      const outputPath = await exportViewableHtml(config.workspacePath, documentPath, documentId)
      res.json({ ok: true, path: outputPath })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/documents/:id/export/pdf', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const documentId = paramValue(req.params.id)
      const documentPath = await resolveDocument(config.workspacePath, documentId)
      const renderUrl = `${req.protocol}://${req.get('host')}/api/documents/${encodeURIComponent(documentId)}/render`
      const outputPath = await exportPdf(config.workspacePath, documentPath, renderUrl)
      res.json({ ok: true, path: outputPath })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/templates', async (_req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      res.json({ templates: await listTemplates(config.workspacePath) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/templates', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const sourceDocumentId = typeof req.body?.sourceDocumentId === 'string' ? req.body.sourceDocumentId : undefined
      const sourceDocumentPath = sourceDocumentId
        ? await getDocumentRelativePath(config.workspacePath, sourceDocumentId).catch(() => undefined)
        : undefined
      const template = await saveTemplate(config.workspacePath, {
        name: String(req.body?.name || ''),
        html: String(req.body?.html || ''),
        sourceDocumentId,
        sourceDocumentPath,
      })
      res.json({ template })
    } catch (error) {
      next(error)
    }
  })

  app.patch('/api/templates/:id', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const template = await updateTemplate(config.workspacePath, paramValue(req.params.id), {
        name: String(req.body?.name || ''),
      })
      res.json({ template })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/templates/:id', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      await deleteTemplate(config.workspacePath, paramValue(req.params.id))
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/documents/:id/templates/insert', requireWriteToken, async (req, res, next) => {
    try {
      const config = await getWorkspaceConfig()
      const documentId = paramValue(req.params.id)
      const documentPath = await resolveDocument(config.workspacePath, documentId)
      const template = await getTemplate(config.workspacePath, String(req.body?.templateId || ''))
      const html = await fs.readFile(documentPath, 'utf8')
      const nextHtml = insertTemplateHtml(html, {
        targetPath: String(req.body?.targetPath || ''),
        placement: normalizePlacement(req.body?.placement),
        html: template.html,
      })
      const backupPath = await createBackup(config.workspacePath, documentPath)
      await fs.writeFile(documentPath, nextHtml, 'utf8')
      res.json({ ok: true, backupPath })
    } catch (error) {
      next(error)
    }
  })

  app.use(errorHandler)
  return app
}

async function getWorkspaceConfig() {
  const config = await readConfig()
  await ensureWorkspace(config.workspacePath)
  return config
}

async function getDocumentRelativePath(workspacePath: string, documentId: string) {
  const documentPath = await resolveDocument(workspacePath, documentId)
  return path.relative(workspacePath, documentPath).replaceAll(path.sep, '/')
}

function requireWriteToken(req: Request, res: Response, next: NextFunction) {
  if (isLocalRequest(req)) {
    next()
    return
  }

  const expected = process.env.HDV_TOKEN
  const actual = req.header('x-hdv-token') || req.query.token
  if (!expected || actual !== expected) {
    res.status(401).json({
      error: 'TOKEN_REQUIRED',
      message: 'Set HDV_TOKEN on the server and send it as x-hdv-token for write/export actions.',
    })
    return
  }

  next()
}

function isLocalRequest(req: Request) {
  const host = req.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || ''
}

function normalizePlacement(value: unknown) {
  if (value === 'before' || value === 'inside-start' || value === 'inside-end') {
    return value
  }
  return 'after'
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  void _next
  const statusCode =
    typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : 500
  const message = error instanceof Error ? error.message : 'Unexpected server error.'
  res.status(statusCode).json({ error: statusCode === 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR', message })
}

const renderCss = `
html {
  min-height: 100%;
}

body {
  margin: 0;
}

.pagedjs_pages {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  min-height: 100vh;
  padding: 34px;
  background: #dfe4eb;
}

.pagedjs_page {
  box-shadow: 0 16px 45px rgba(18, 26, 42, 0.18);
}

[data-hdv-path] {
  cursor: default;
}

.hdv-hover {
  outline: 2px solid rgba(25, 111, 255, 0.7) !important;
  outline-offset: 2px !important;
}

.hdv-selected {
  outline: 2px solid #0f62fe !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 4px rgba(15, 98, 254, 0.16) !important;
}
`

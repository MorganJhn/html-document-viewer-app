import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { ensureWorkspace, isPathInside } from './paths'
import { renderDocumentMarkup } from './html'

export async function exportViewableHtml(rootPath: string, documentPath: string, documentId: string) {
  const folders = await ensureWorkspace(rootPath)
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const baseName = path.basename(documentPath, path.extname(documentPath))
  const exportDir = path.join(folders.exports, `${baseName}-${timestamp}`)
  const assetsDir = path.join(exportDir, 'assets')

  await fs.mkdir(exportDir, { recursive: true })
  await copySiblingAssets(path.dirname(documentPath), assetsDir, documentPath)

  const source = await fs.readFile(documentPath, 'utf8')
  const html = renderDocumentMarkup(source, documentId, { exportBaseHref: './assets/' })
  const inlined = await inlinePagedScript(html)
  const indexPath = path.join(exportDir, 'index.html')
  await fs.writeFile(indexPath, inlined, 'utf8')
  return indexPath
}

export async function exportPdf(rootPath: string, documentPath: string, renderUrl: string) {
  const folders = await ensureWorkspace(rootPath)
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const baseName = path.basename(documentPath, path.extname(documentPath))
  const pdfPath = path.join(folders.exports, `${baseName}-${timestamp}.pdf`)
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()
    await page.emulateMedia({ media: 'print' })
    await page.goto(renderUrl, { waitUntil: 'networkidle' })
    await page.waitForFunction(
      'Boolean(document.querySelector(".pagedjs_pages")) || !("PagedPolyfill" in window)',
    )
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: true,
    })
  } finally {
    await browser.close()
  }

  return pdfPath
}

async function copySiblingAssets(sourceDir: string, targetDir: string, documentPath: string) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '_hdv') {
      continue
    }
    const source = path.join(sourceDir, entry.name)
    const target = path.join(targetDir, entry.name)
    if (!isPathInside(sourceDir, source) || source === documentPath) {
      continue
    }
    if (entry.isDirectory()) {
      await copySiblingAssets(source, target, documentPath)
    } else if (entry.isFile()) {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.copyFile(source, target)
    }
  }
}

async function inlinePagedScript(html: string) {
  const scriptPath = path.join(process.cwd(), 'node_modules', 'pagedjs', 'dist', 'paged.polyfill.js')
  const script = await fs.readFile(scriptPath, 'utf8')
  return html.replace('<script src="/vendor/paged.polyfill.js"></script>', `<script>${script}</script>`)
}

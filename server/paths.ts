import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const PROJECT_ROOT = process.cwd()
export const APP_STATE_DIR = path.resolve(process.env.HDV_STATE_DIR || path.join(PROJECT_ROOT, '.hdv'))
export const APP_CONFIG_PATH = path.join(APP_STATE_DIR, 'config.json')
export const INTERNAL_DIR = '_hdv'

export interface AppConfig {
  workspacePath: string
}

export interface WorkspaceFolders {
  root: string
  internal: string
  backups: string
  exports: string
  templates: string
}

export interface DocumentRecord {
  id: string
  name: string
  relativePath: string
  absolutePath: string
  modifiedAt: string
  size: number
}

export function defaultWorkspacePath() {
  return path.resolve(process.env.DOCUMENT_WORKSPACE || path.join(PROJECT_ROOT, 'workspace'))
}

export function encodeDocumentId(relativePath: string) {
  return Buffer.from(relativePath.replaceAll(path.sep, '/')).toString('base64url')
}

export function decodeDocumentId(id: string) {
  return Buffer.from(id, 'base64url').toString('utf8')
}

export function normalizePath(inputPath: string) {
  return path.resolve(inputPath.trim())
}

export function isPathInside(rootPath: string, candidatePath: string) {
  const root = normalizeForCompare(path.resolve(rootPath))
  const candidate = normalizeForCompare(path.resolve(candidatePath))
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)
}

export async function readConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(APP_CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return { workspacePath: normalizePath(parsed.workspacePath || defaultWorkspacePath()) }
  } catch {
    return { workspacePath: defaultWorkspacePath() }
  }
}

export async function writeConfig(config: AppConfig) {
  await fs.mkdir(APP_STATE_DIR, { recursive: true })
  await fs.writeFile(APP_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

export async function ensureWorkspace(rootPath: string): Promise<WorkspaceFolders> {
  const root = normalizePath(rootPath)
  const folders = {
    root,
    internal: path.join(root, INTERNAL_DIR),
    backups: path.join(root, INTERNAL_DIR, 'backups'),
    exports: path.join(root, INTERNAL_DIR, 'exports'),
    templates: path.join(root, INTERNAL_DIR, 'templates'),
  }

  await fs.mkdir(folders.backups, { recursive: true })
  await fs.mkdir(folders.exports, { recursive: true })
  await fs.mkdir(folders.templates, { recursive: true })
  return folders
}

export async function listDocuments(rootPath: string): Promise<DocumentRecord[]> {
  const root = normalizePath(rootPath)
  const documents: DocumentRecord[] = []
  await walk(root, async (absolutePath) => {
    if (!/\.(html|htm)$/i.test(absolutePath)) {
      return
    }

    const stat = await fs.stat(absolutePath)
    const relativePath = path.relative(root, absolutePath)
    documents.push({
      id: encodeDocumentId(relativePath),
      name: path.basename(absolutePath),
      relativePath: relativePath.replaceAll(path.sep, '/'),
      absolutePath,
      modifiedAt: stat.mtime.toISOString(),
      size: stat.size,
    })
  })

  return documents.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

export async function resolveDocument(rootPath: string, id: string) {
  const root = normalizePath(rootPath)
  const decoded = decodeDocumentId(id)
  const absolutePath = path.resolve(root, decoded)
  if (!isPathInside(root, absolutePath) || !/\.(html|htm)$/i.test(absolutePath)) {
    throw Object.assign(new Error('Document path is outside the workspace.'), { statusCode: 400 })
  }
  await fs.access(absolutePath)
  return absolutePath
}

export async function createBackup(rootPath: string, documentPath: string) {
  const folders = await ensureWorkspace(rootPath)
  const relative = path.relative(folders.root, documentPath).replaceAll(path.sep, '__')
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const target = path.join(folders.backups, `${timestamp}__${relative}.bak`)
  await fs.copyFile(documentPath, target)
  return target
}

export async function getFsRoots(currentWorkspace: string) {
  const roots = new Set<string>([
    normalizePath(currentWorkspace),
    defaultWorkspacePath(),
    os.homedir(),
    path.parse(PROJECT_ROOT).root,
  ])

  if (process.platform === 'win32') {
    for (let code = 65; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`
      try {
        await fs.access(drive)
        roots.add(drive)
      } catch {
        // Ignore absent drives.
      }
    }
  } else {
    roots.add('/')
  }

  return [...roots].sort()
}

export async function listDirectoryChildren(parentPath: string) {
  const root = normalizePath(parentPath)
  const entries = await fs.readdir(root, { withFileTypes: true })
  const children = await Promise.all(
    entries
      .filter((entry) => entry.name !== INTERNAL_DIR && (!entry.name.startsWith('.') || entry.name === '..'))
      .map(async (entry) => {
        const absolutePath = path.join(root, entry.name)
        return {
          name: entry.name,
          path: absolutePath,
          isDirectory: entry.isDirectory(),
        }
      }),
  )

  return children
    .filter((child) => child.isDirectory)
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function walk(root: string, visit: (absolutePath: string) => Promise<void>) {
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === INTERNAL_DIR || entry.name === 'node_modules') {
        continue
      }
      await walk(absolutePath, visit)
    } else if (entry.isFile()) {
      await visit(absolutePath)
    }
  }
}

function normalizeForCompare(inputPath: string) {
  const resolved = path.resolve(inputPath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

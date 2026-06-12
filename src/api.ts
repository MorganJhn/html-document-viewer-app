import type {
  DocumentDetail,
  DocumentSettings,
  DocumentSummary,
  ElementEdit,
  FsChild,
  TemplateRecord,
  WorkspaceInfo,
} from './types'

const TOKEN_KEY = 'hdvToken'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setStoredToken(token: string) {
  if (token.trim()) {
    localStorage.setItem(TOKEN_KEY, token.trim())
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: tokenHeaders() })
  return parseResponse<T>(response)
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...tokenHeaders(),
    },
    body: JSON.stringify(body || {}),
  })
  return parseResponse<T>(response)
}

export const api = {
  getWorkspace: () => apiGet<WorkspaceInfo>('/api/workspace'),
  setWorkspace: (workspacePath: string) => apiPost<WorkspaceInfo>('/api/workspace', { workspacePath }),
  getRoots: () => apiGet<{ roots: string[] }>('/api/fs/roots'),
  getChildren: (folderPath: string) => apiGet<{ children: FsChild[] }>(`/api/fs/children?path=${encodeURIComponent(folderPath)}`),
  listDocuments: () => apiGet<{ documents: DocumentSummary[] }>('/api/documents'),
  createDocument: (payload: { name: string; settings: DocumentSettings }) =>
    apiPost<{ ok: true; document: DocumentDetail }>('/api/documents', payload),
  getDocument: (id: string) => apiGet<DocumentDetail>(`/api/documents/${encodeURIComponent(id)}`),
  saveEdits: (id: string, payload: { elementEdits?: ElementEdit[]; documentSettings?: DocumentSettings }) =>
    apiPost<{ ok: true; backupPath: string }>(`/api/documents/${encodeURIComponent(id)}/edits`, payload),
  exportHtml: (id: string) => apiPost<{ ok: true; path: string }>(`/api/documents/${encodeURIComponent(id)}/export/html`),
  exportPdf: (id: string) => apiPost<{ ok: true; path: string }>(`/api/documents/${encodeURIComponent(id)}/export/pdf`),
  listTemplates: () => apiGet<{ templates: TemplateRecord[] }>('/api/templates'),
  saveTemplate: (payload: { name: string; html: string; sourceDocumentId?: string }) =>
    apiPost<{ template: TemplateRecord }>('/api/templates', payload),
  updateTemplate: (id: string, payload: { name: string }) =>
    apiPatch<{ template: TemplateRecord }>(`/api/templates/${encodeURIComponent(id)}`, payload),
  deleteTemplate: (id: string) => apiDelete<{ ok: true }>(`/api/templates/${encodeURIComponent(id)}`),
  insertTemplate: (id: string, payload: { templateId: string; targetPath: string; placement: string }) =>
    apiPost<{ ok: true; backupPath: string }>(`/api/documents/${encodeURIComponent(id)}/templates/insert`, payload),
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...tokenHeaders(),
    },
    body: JSON.stringify(body || {}),
  })
  return parseResponse<T>(response)
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: tokenHeaders(),
  })
  return parseResponse<T>(response)
}

function tokenHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { 'x-hdv-token': token } : {}
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = body?.message || body?.error || `Request failed with ${response.status}`
    throw Object.assign(new Error(message), { status: response.status, code: body?.error })
  }
  return body as T
}

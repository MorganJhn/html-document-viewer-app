export interface WorkspaceInfo {
  workspacePath: string
  internalPath: string
}

export interface DocumentSummary {
  id: string
  name: string
  relativePath: string
  modifiedAt: string
  size: number
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

export interface DocumentDetail extends DocumentSummary {
  settings: DocumentSettings
}

export interface ElementProperties {
  path: string
  label: string
  tag: string
  text: string
  fontSize: string
  fontFamily: string
  color: string
  backgroundColor: string
  width: string
  height: string
  pageX: string
  pageY: string
  documentX: string
  documentY: string
  margin: string
  padding: string
  opacity: string
  border: string
  transform: string
  position: string
}

export interface SelectionItem {
  path: string
  label: string
  agentReference: string
  tag: string
  properties: ElementProperties
}

export interface ElementEdit {
  targetPath: string
  styles?: Record<string, string | null>
  attributes?: Record<string, string | null>
  textContent?: string
}

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

export interface FsChild {
  name: string
  path: string
  isDirectory: boolean
}

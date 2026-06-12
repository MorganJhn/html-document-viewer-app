import { Copy, FileSliders, Library, Trash2, Type, LayoutDashboard, MousePointer2, Sliders } from 'lucide-react'
import type { DocumentSettings, ElementEdit, SelectionItem, TemplateRecord } from '../types'
import { DocumentControls } from './DocumentControls'
import { Button, EmptyState, Field, IconButton, Tabs } from './ui'

export type InspectorTab = 'selection' | 'document' | 'library'

interface InspectorPanelProps {
  activeTab: InspectorTab
  selectedItems: SelectionItem[]
  settings: DocumentSettings
  settingsDirty: boolean
  pendingChangeCount: number
  templates: TemplateRecord[]
  templateName: string
  inlineTemplateStyles: boolean
  selectedTemplateId: string
  templatePlacement: string
  librarySearch: string
  renameTemplateName: string
  onTabChange: (value: InspectorTab) => void
  onSettingsChange: (settings: DocumentSettings) => void
  onTemplateNameChange: (value: string) => void
  onInlineTemplateStylesChange: (value: boolean) => void
  onSelectedTemplateChange: (value: string) => void
  onTemplatePlacementChange: (value: string) => void
  onLibrarySearchChange: (value: string) => void
  onRenameTemplateNameChange: (value: string) => void
  onElementEdit: (edit: Omit<ElementEdit, 'targetPath'>) => void
  onSaveTemplate: () => void
  onInsertTemplate: () => void
  onRenameTemplate: () => void
  onDeleteTemplate: () => void
  onTemplateContextMenu?: (e: React.MouseEvent, template: TemplateRecord) => void
}

export function InspectorPanel({
  activeTab,
  selectedItems,
  settings,
  settingsDirty,
  pendingChangeCount,
  templates,
  templateName,
  inlineTemplateStyles,
  selectedTemplateId,
  templatePlacement,
  librarySearch,
  renameTemplateName,
  onTabChange,
  onSettingsChange,
  onTemplateNameChange,
  onInlineTemplateStylesChange,
  onSelectedTemplateChange,
  onTemplatePlacementChange,
  onLibrarySearchChange,
  onRenameTemplateNameChange,
  onElementEdit,
  onSaveTemplate,
  onInsertTemplate,
  onRenameTemplate,
  onDeleteTemplate,
  onTemplateContextMenu,
}: InspectorPanelProps) {
  const primary = selectedItems[0]
  const properties = primary?.properties
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
  const filteredTemplates = templates.filter((template) => {
    const query = librarySearch.trim().toLowerCase()
    if (!query) {
      return true
    }
    return (
      template.name.toLowerCase().includes(query) ||
      template.previewText.toLowerCase().includes(query) ||
      template.sourceDocumentPath?.toLowerCase().includes(query)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      <Tabs
        value={activeTab}
        onChange={onTabChange}
        tabs={[
          {
            value: 'selection',
            label: <MousePointer2 size={13} />,
            count: selectedItems.length,
            title: 'Selection properties',
          },
          {
            value: 'document',
            label: <Sliders size={13} />,
            count: settingsDirty ? 1 : undefined,
            title: 'Document page setup',
          },
          {
            value: 'library',
            label: <Library size={13} />,
            count: templates.length,
            title: 'Component library',
          },
        ]}
      />

      {/* ── SELECTION TAB ─────────────────────────────────── */}
      {activeTab === 'selection' && (
        <div className="inspector-scroll">
          {!properties ? (
            <div className="inspector-section">
              <EmptyState
                title="No component selected"
                body="Enable Select mode and click any element in the document to inspect it."
              />
            </div>
          ) : (
            <>
              <section className="inspector-section">
                <div className="selected-heading">
                  <div>
                    <span>
                      {selectedItems.length > 1 ? `${selectedItems.length} components` : properties.label}
                    </span>
                    <small>{selectedItems.length > 1 ? 'Batch editing shared fields' : breadcrumbFor(primary)}</small>
                  </div>
                  <IconButton
                    title="Copy agent references to clipboard"
                    onClick={() =>
                      navigator.clipboard.writeText(selectedItems.map((item) => item.agentReference).join('\n'))
                    }
                  >
                    <Copy size={14} />
                  </IconButton>
                </div>

                <Field label="Text content">
                  <textarea
                    value={properties.text}
                    rows={3}
                    onChange={(event) => onElementEdit({ textContent: event.target.value })}
                  />
                </Field>
              </section>

              <section className="inspector-section">
                <div className="section-label">
                  <Type size={13} />
                  <span>Typography & Fill</span>
                </div>
                <div className="field-grid">
                  <Field label="Font size">
                    <input
                      value={properties.fontSize}
                      onChange={(event) => onElementEdit({ styles: { 'font-size': event.target.value } })}
                    />
                  </Field>
                  <Field label="Color">
                    <input
                      value={properties.color}
                      onChange={(event) => onElementEdit({ styles: { color: event.target.value } })}
                    />
                  </Field>
                  <Field label="Background">
                    <input
                      value={properties.backgroundColor}
                      onChange={(event) => onElementEdit({ styles: { background: event.target.value } })}
                    />
                  </Field>
                  <Field label="Opacity">
                    <input
                      value={properties.opacity}
                      onChange={(event) => onElementEdit({ styles: { opacity: event.target.value } })}
                    />
                  </Field>
                </div>
              </section>

              <section className="inspector-section">
                <div className="section-label">
                  <LayoutDashboard size={13} />
                  <span>Layout</span>
                </div>
                <div className="property-list">
                  <Property label="Size" value={`${properties.width} × ${properties.height}`} />
                  <Property label="Page pos." value={`${properties.pageX}, ${properties.pageY}`} />
                  <Property label="Doc pos." value={`${properties.documentX}, ${properties.documentY}`} />
                  <Property label="Margin" value={properties.margin} />
                  <Property label="Padding" value={properties.padding} />
                  <Property label="Border" value={properties.border} />
                  <Property label="Position" value={properties.position} />
                  <Property label="Transform" value={properties.transform || 'none'} />
                </div>
                <div className="field-grid">
                  <Field label="Width">
                    <input
                      value={properties.width}
                      onChange={(event) => onElementEdit({ styles: { width: event.target.value } })}
                    />
                  </Field>
                  <Field label="Height">
                    <input
                      value={properties.height}
                      onChange={(event) => onElementEdit({ styles: { height: event.target.value } })}
                    />
                  </Field>
                </div>
              </section>

              <section className="inspector-section">
                <div className="section-label">Identity</div>
                <Field label="Component name">
                  <input
                    defaultValue={primary.label}
                    onBlur={(event) =>
                      onElementEdit({ attributes: { 'data-component': event.target.value } })
                    }
                  />
                </Field>
              </section>
            </>
          )}
        </div>
      )}

      {/* ── DOCUMENT TAB ──────────────────────────────────── */}
      {activeTab === 'document' && (
        <div className="inspector-scroll">
          <section className="inspector-section">
            <div className="section-label">
              <FileSliders size={13} />
              <span>Page setup</span>
            </div>
            <DocumentControls settings={settings} onChange={onSettingsChange} layout="stacked" />
          </section>
          <section className="inspector-section">
            <div className="section-label">Current values</div>
            <div className="property-list">
              <Property label="Page" value={`${settings.pageSizePreset} ${settings.orientation}`} />
              <Property
                label="Margins"
                value={`${settings.marginTop} ${settings.marginRight} ${settings.marginBottom} ${settings.marginLeft}`}
              />
              <Property label="Background" value={settings.backgroundColor} />
              <Property label="State" value={settingsDirty ? 'Unsaved document settings' : 'Saved'} />
            </div>
          </section>
        </div>
      )}

      {/* ── LIBRARY TAB ────────────────────────────────────── */}
      {activeTab === 'library' && (
        <div className="inspector-scroll">
          <section className="inspector-section">
            <div className="section-label">
              <Library size={13} />
              <span>Save as component</span>
            </div>
            <Field label="Component name">
              <input
                value={templateName}
                onChange={(event) => onTemplateNameChange(event.target.value)}
                placeholder={selectedItems.length > 1 ? `Group of ${selectedItems.length} components…` : "Name this component…"}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={inlineTemplateStyles}
                onChange={(event) => onInlineTemplateStylesChange(event.target.checked)}
              />
              <span>Inline computed styles for cross-document reuse</span>
            </label>
            <Button variant="primary" disabled={!selectedItems.length} onClick={onSaveTemplate}>
              Save as component
            </Button>
          </section>

          <section className="inspector-section component-library">
            <div className="section-label">
              Library
              {filteredTemplates.length > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: 'var(--accent-muted)',
                    color: 'var(--accent-bright)',
                    letterSpacing: 0,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {filteredTemplates.length}
                </span>
              )}
            </div>
            <input
              className="search-input"
              value={librarySearch}
              onChange={(event) => onLibrarySearchChange(event.target.value)}
              placeholder="Search components…"
              style={{ marginBottom: 0 }}
            />
            <div className="component-list">
              {filteredTemplates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={
                    template.id === selectedTemplateId
                      ? 'component-card component-card--active'
                      : 'component-card'
                  }
                  onClick={() => onSelectedTemplateChange(template.id)}
                  onContextMenu={(e) => onTemplateContextMenu?.(e, template)}
                >
                  <strong>{template.name}</strong>
                  <span>{template.previewText || 'No text preview'}</span>
                  <small>{template.sourceDocumentPath || 'Saved component'}</small>
                </button>
              ))}
              {!filteredTemplates.length && (
                <EmptyState
                  title="No components"
                  body="Save a selected element to reuse it across documents."
                />
              )}
            </div>
          </section>

          <section className="inspector-section">
            <div className="section-label">Insert & manage</div>
            <div className="field-grid">
              <Field label="Placement">
                <select
                  value={templatePlacement}
                  onChange={(event) => onTemplatePlacementChange(event.target.value)}
                >
                  <option value="after">After</option>
                  <option value="before">Before</option>
                  <option value="inside-end">Inside end</option>
                  <option value="inside-start">Inside start</option>
                </select>
              </Field>
              <Field label="Selected">
                <input value={selectedTemplate?.name || ''} readOnly placeholder="Choose component" />
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={!selectedTemplateId || !selectedItems.length}
              onClick={onInsertTemplate}
            >
              Insert component
            </Button>

            <div style={{ height: 10 }} />
            <Field label="Rename component">
              <input
                value={renameTemplateName}
                onChange={(event) => onRenameTemplateNameChange(event.target.value)}
                placeholder={selectedTemplate?.name || 'Choose a component first'}
              />
            </Field>
            <div className="split-actions">
              <Button
                variant="secondary"
                disabled={!selectedTemplateId || !renameTemplateName.trim()}
                onClick={onRenameTemplate}
              >
                Rename
              </Button>
              <Button variant="danger" disabled={!selectedTemplateId} onClick={onDeleteTemplate}>
                <Trash2 size={13} />
                Delete
              </Button>
            </div>
          </section>
        </div>
      )}

      <div className="inspector-footer">
        <span>{pendingChangeCount} pending edit{pendingChangeCount !== 1 ? 's' : ''}</span>
        <span>{settings.pageSizePreset} / {settings.orientation}</span>
      </div>
    </div>
  )
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="property-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function breadcrumbFor(item: SelectionItem) {
  return `${item.tag} › ${item.path}`
}

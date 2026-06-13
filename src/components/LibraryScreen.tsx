import { FileText, Library, Search } from "lucide-react";
import type { TemplateRecord } from "../types";

interface LibraryScreenProps {
  filteredTemplates: TemplateRecord[];
  selectedTemplateId: string;
  activeTemplate: TemplateRecord | undefined;
  librarySearch: string;
  renameTemplateName: string;
  onLibrarySearchChange: (value: string) => void;
  onTemplateSelect: (id: string) => void;
  onTemplateContextMenu: (event: React.MouseEvent, template: TemplateRecord) => void;
  onRenameTemplateNameChange: (value: string) => void;
  onRenameTemplate: () => void;
  onDeleteTemplate: () => void;
  onReturnToEditor: () => void;
}

export function LibraryScreen({
  filteredTemplates,
  selectedTemplateId,
  activeTemplate,
  librarySearch,
  renameTemplateName,
  onLibrarySearchChange,
  onTemplateSelect,
  onTemplateContextMenu,
  onRenameTemplateNameChange,
  onRenameTemplate,
  onDeleteTemplate,
  onReturnToEditor,
}: LibraryScreenProps) {
  return (
    <div className="library-screen-container">
      <div className="library-grid-column">
        <div className="library-grid-header">
          <div>
            <h2>Components Library</h2>
            <span>
              {filteredTemplates.length} templates saved in this workspace
            </span>
          </div>

          <div className="library-search-box">
            <Search size={12} />
            <input
              value={librarySearch}
              onChange={(event) => onLibrarySearchChange(event.target.value)}
              placeholder="Search components by name or content…"
            />
          </div>
        </div>

        <div className="library-cards-scroll">
          <div className="library-cards-grid">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={
                  template.id === selectedTemplateId
                    ? "library-card-item library-card-item--active"
                    : "library-card-item"
                }
                onClick={() => onTemplateSelect(template.id)}
                onContextMenu={(e) => onTemplateContextMenu(e, template)}
                onDoubleClick={() => {
                  onTemplateSelect(template.id);
                  onReturnToEditor();
                }}
              >
                <div className="library-card-preview">
                  <FileText size={28} />
                  <div className="card-html-badge">HTML</div>
                </div>
                <div className="library-card-meta">
                  <strong>{template.name}</strong>
                  <span>
                    {template.previewText || "No text preview available"}
                  </span>
                  <small>
                    {template.sourceDocumentPath || "Saved template"}
                  </small>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <div className="library-empty-grid">
                <Library size={36} />
                <strong>No components found</strong>
                <span>
                  Save components from the document editor workspace to see
                  them here.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="library-inspector-column">
        <div className="inspector-header-title">
          <span>Component Properties</span>
        </div>

        {activeTemplate ? (
          <div className="library-inspector-scroll">
            <section className="library-inspector-section">
              <h3>Identity</h3>
              <div className="property-list">
                <div className="property-row">
                  <span>Name</span>
                  <strong>{activeTemplate.name}</strong>
                </div>
                <div className="property-row">
                  <span>Source doc</span>
                  <strong>
                    {activeTemplate.sourceDocumentPath || "Unknown"}
                  </strong>
                </div>
                <div className="property-row">
                  <span>Snippet size</span>
                  <strong>{activeTemplate.html.length} bytes</strong>
                </div>
              </div>
            </section>

            <section className="library-inspector-section">
              <h3>Rename Component</h3>
              <label className="field">
                <span>Name</span>
                <input
                  value={renameTemplateName}
                  onChange={(event) =>
                    onRenameTemplateNameChange(event.target.value)
                  }
                  placeholder="Enter new template name…"
                />
              </label>
              <button
                type="button"
                className="secondary-button"
                style={{ width: "100%", minHeight: 28, fontSize: 11 }}
                disabled={!renameTemplateName.trim()}
                onClick={onRenameTemplate}
              >
                Rename Component
              </button>
            </section>

            <section className="library-inspector-section">
              <h3>HTML Source Code</h3>
              <div className="library-code-wrapper">
                <pre>
                  <code>{activeTemplate.html}</code>
                </pre>
              </div>
            </section>

            <section
              className="library-inspector-section"
              style={{ borderBottom: "none", marginTop: "auto" }}
            >
              <div className="split-actions">
                <button
                  type="button"
                  className="primary-button"
                  style={{ flex: 1, minHeight: 28, fontSize: 11 }}
                  onClick={onReturnToEditor}
                >
                  Open in Editor
                </button>
                <button
                  type="button"
                  className="button--danger"
                  style={{
                    minHeight: 28,
                    fontSize: 11,
                    padding: "0 10px",
                    width: "auto",
                  }}
                  onClick={onDeleteTemplate}
                >
                  Delete
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="library-inspector-empty">
            <Library size={24} />
            <span>Select a template component card to view details.</span>
          </div>
        )}
      </aside>
    </div>
  );
}

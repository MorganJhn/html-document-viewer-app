import {
  Copy,
  FileSliders,
  Library,
  Trash2,
  Type,
  LayoutDashboard,
  MousePointer2,
  Sliders,
} from "lucide-react";
import type {
  DocumentSettings,
  ElementEdit,
  SelectionItem,
  TemplateRecord,
} from "../types";
import { DocumentControls } from "./DocumentControls";
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Tabs,
} from "./ui";
import { colorToHex, toast, formatBreadcrumb, copyToClipboard } from "../lib/utils";

export type InspectorTab = "selection" | "document" | "library";

interface InspectorPanelProps {
  activeTab: InspectorTab;
  selectedItems: SelectionItem[];
  settings: DocumentSettings;
  settingsDirty: boolean;
  pendingChangeCount: number;
  templates: TemplateRecord[];
  templateName: string;
  inlineTemplateStyles: boolean;
  selectedTemplateId: string;
  templatePlacement: string;
  librarySearch: string;
  renameTemplateName: string;
  onTabChange: (value: InspectorTab) => void;
  onSettingsChange: (settings: DocumentSettings) => void;
  onTemplateNameChange: (value: string) => void;
  onInlineTemplateStylesChange: (value: boolean) => void;
  onSelectedTemplateChange: (value: string) => void;
  onTemplatePlacementChange: (value: string) => void;
  onLibrarySearchChange: (value: string) => void;
  onRenameTemplateNameChange: (value: string) => void;
  onElementEdit: (edit: Omit<ElementEdit, "targetPath">) => void;
  onSaveTemplate: () => void;
  onInsertTemplate: () => void;
  onRenameTemplate: () => void;
  onDeleteTemplate: () => void;
  onTemplateContextMenu?: (
    e: React.MouseEvent,
    template: TemplateRecord,
  ) => void;
  ancestors?: Array<{ tag: string; path: string; label: string }>;
  onSelectAncestor?: (path: string) => void;
  pendingEdits?: Record<string, ElementEdit>;
  documentId?: string;
  globalStyle?: string;
  pendingGlobalStyle?: string | null;
  onGlobalStyleChange?: (css: string) => void;
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
  ancestors,
  onSelectAncestor,
  pendingEdits,
  documentId,
  globalStyle = "",
  pendingGlobalStyle = null,
  onGlobalStyleChange,
}: InspectorPanelProps) {
  const primary = selectedItems[0];
  const properties = primary?.properties;

  const isFieldDirty = (
    path: string,
    type: "style" | "attribute" | "text",
    name?: string
  ): boolean => {
    if (!pendingEdits || !path) return false;
    const edit = pendingEdits[path];
    if (!edit) return false;

    if (type === "text") {
      return typeof edit.textContent === "string";
    }
    if (type === "style" && name) {
      return edit.styles ? Object.prototype.hasOwnProperty.call(edit.styles, name) : false;
    }
    if (type === "attribute" && name) {
      return edit.attributes ? Object.prototype.hasOwnProperty.call(edit.attributes, name) : false;
    }
    return false;
  };

  const dirtyStyle = (isDirty: boolean): React.CSSProperties => {
    return isDirty
      ? {
          borderColor: "var(--accent-bright)",
          boxShadow: "0 0 0 1px var(--accent-glow)",
        }
      : {};
  };

  const formatStyleValue = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return `${trimmed}px`;
    }
    return trimmed;
  };

  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );
  const filteredTemplates = templates.filter((template) => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      template.name.toLowerCase().includes(query) ||
      template.previewText.toLowerCase().includes(query) ||
      template.sourceDocumentPath?.toLowerCase().includes(query)
    );
  });

  const renderScrollContent = (children: React.ReactNode) => {
    return <div className="inspector-scroll">{children}</div>;
  };

  const sectionStyle = undefined;

  const docSetupSectionStyle = undefined;

  const librarySectionStyle = undefined;


  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Tabs
        value={activeTab}
        onChange={onTabChange}
        tabs={[
          {
            value: "selection",
            label: <MousePointer2 size={13} />,
            count: selectedItems.length,
            title: "Selection properties",
          },
          {
            value: "document",
            label: <Sliders size={13} />,
            count: settingsDirty ? 1 : undefined,
            title: "Document page setup",
          },
          {
            value: "library",
            label: <Library size={13} />,
            count: templates.length,
            title: "Component library",
          },
        ]}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* ── SELECTION TAB ─────────────────────────────────── */}
          {activeTab === "selection" &&
            renderScrollContent(
              !properties ? (
                <div className="inspector-section" style={sectionStyle}>
                  <EmptyState
                    title="No component selected"
                    body="Enable Select mode and click any element in the document to inspect it."
                  />
                </div>
              ) : (
                <>
                  <section className="inspector-section" style={sectionStyle}>
                    <div className="selected-heading">
                      <div>
                        <span>
                          {selectedItems.length > 1
                            ? `${selectedItems.length} components`
                            : properties.label}
                        </span>
                        <small>
                          {selectedItems.length > 1 ? (
                            "Batch editing shared fields"
                           ) : ancestors && ancestors.length > 0 ? (
                            <span style={{ display: "flex", flexWrap: "wrap", gap: "3px", alignItems: "center" }}>
                              {ancestors.map((ancestor, index) => {
                                const isCurrent = index === ancestors.length - 1;
                                return (
                                  <span key={`${ancestor.path}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <button
                                      type="button"
                                      disabled={isCurrent}
                                      onClick={() => onSelectAncestor?.(ancestor.path)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        padding: "1px 3px",
                                        fontSize: "9.5px",
                                        color: isCurrent ? "var(--accent)" : "var(--text-3)",
                                        fontWeight: isCurrent ? "600" : "400",
                                        cursor: isCurrent ? "default" : "pointer",
                                        borderRadius: "2px",
                                        transition: "all 0.15s ease",
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isCurrent) {
                                          e.currentTarget.style.color = "var(--text-1)";
                                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isCurrent) {
                                          e.currentTarget.style.color = "var(--text-3)";
                                          e.currentTarget.style.background = "none";
                                        }
                                      }}
                                    >
                                      {formatBreadcrumb(ancestor.label)}
                                    </button>
                                    {index < ancestors.length - 1 && (
                                      <span style={{ fontSize: "9px", color: "var(--text-4)" }}>&gt;</span>
                                    )}
                                  </span>
                                );
                              })}
                            </span>
                          ) : (
                            breadcrumbFor(primary)
                          )}
                        </small>
                      </div>
                      <IconButton
                        title="Copy agent references to clipboard"
                        onClick={() =>
                          void copyToClipboard(
                            selectedItems
                              .map((item) => item.agentReference)
                              .join("\n"),
                          )
                        }
                      >
                        <Copy size={14} />
                      </IconButton>
                    </div>

                    <Field label="Text content">
                      <textarea
                        value={properties.text}
                        rows={3}
                        onChange={(event) =>
                          onElementEdit({ textContent: event.target.value })
                        }
                        style={dirtyStyle(isFieldDirty(primary.path, "text"))}
                      />
                    </Field>
                  </section>

                  {/* Image Properties (Item 41) */}
                  {properties.tag === "img" && (
                    <section className="inspector-section" style={sectionStyle}>
                      <div className="section-label">Image Properties</div>
                      <Field label="Image Source (src)">
                        <input
                          value={properties.src}
                          onChange={(event) =>
                            onElementEdit({
                              attributes: { src: event.target.value },
                            })
                          }
                          style={dirtyStyle(isFieldDirty(primary.path, "attribute", "src"))}
                        />
                      </Field>
                      <Field label="Upload Sibling Image">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file || !documentId) return;

                            const reader = new FileReader();
                            reader.onload = async () => {
                              const result = reader.result as string;
                              const base64 = result.split(",")[1];
                              try {
                                const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/assets`, {
                                  method: "POST",
                                  headers: {
                                    "content-type": "application/json",
                                  },
                                  body: JSON.stringify({ filename: file.name, base64 }),
                                });
                                const data = await response.json();
                                if (response.ok && data.filename) {
                                  onElementEdit({
                                    attributes: { src: data.filename },
                                  });
                                  toast("Image uploaded successfully.", "success");
                                } else {
                                  toast(data.message || "Failed to upload image.", "error");
                                }
                              } catch {
                                toast("Error uploading image.", "error");
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                          style={{
                            border: "none",
                            background: "none",
                            padding: 0,
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        />
                      </Field>
                    </section>
                  )}

                  <section className="inspector-section" style={sectionStyle}>
                    <div className="section-label">
                      <Type size={13} />
                      <span>Typography & Fill</span>
                    </div>
                    <div className="field-grid">
                      <Field label="Font size">
                        <input
                          value={properties.fontSize}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { "font-size": event.target.value },
                            })
                          }
                          onBlur={(event) => {
                            const formatted = formatStyleValue(event.target.value);
                            if (formatted !== event.target.value) {
                              onElementEdit({
                                styles: { "font-size": formatted },
                              });
                            }
                          }}
                          style={dirtyStyle(isFieldDirty(primary.path, "style", "font-size"))}
                        />
                      </Field>
                      <Field label="Font family" style={{ gridColumn: "1 / span 2" }}>
                        <select
                          value={getSelectableFontFamily(properties.fontFamily)}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { "font-family": event.target.value },
                            })
                          }
                          style={dirtyStyle(isFieldDirty(primary.path, "style", "font-family"))}
                        >
                          <option value="">Default</option>
                          <option value="system-ui, -apple-system, sans-serif">System Sans</option>
                          <option value="Inter, sans-serif">Inter</option>
                          <option value="JetBrains Mono, monospace">JetBrains Mono</option>
                          <option value="Arial, sans-serif">Arial</option>
                          <option value="Georgia, serif">Georgia</option>
                          <option value="Courier New, monospace">Courier New</option>
                          <option value="Times New Roman, serif">Times New Roman</option>
                          {properties.fontFamily && !isStandardFont(properties.fontFamily) && (
                            <option value={properties.fontFamily}>{properties.fontFamily}</option>
                          )}
                        </select>
                      </Field>
                      <Field label="Color">
                        <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                          <input
                            type="color"
                            value={colorToHex(properties.color)}
                            onChange={(event) =>
                              onElementEdit({
                                styles: { color: event.target.value },
                              })
                            }
                            style={{
                              width: "28px",
                              height: "24px",
                              padding: "0",
                              border: "1px solid var(--border-soft)",
                              borderRadius: "var(--r-xs)",
                              cursor: "pointer",
                              background: "none",
                              flexShrink: 0
                            }}
                          />
                          <input
                            value={properties.color}
                            onChange={(event) =>
                              onElementEdit({
                                styles: { color: event.target.value },
                              })
                            }
                            style={{
                              flex: 1,
                              minWidth: 0,
                              ...dirtyStyle(isFieldDirty(primary.path, "style", "color")),
                            }}
                          />
                        </div>
                      </Field>
                      <Field label="Background">
                        <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                          <input
                            type="color"
                            value={colorToHex(properties.backgroundColor)}
                            onChange={(event) =>
                              onElementEdit({
                                styles: { background: event.target.value },
                              })
                            }
                            style={{
                              width: "28px",
                              height: "24px",
                              padding: "0",
                              border: "1px solid var(--border-soft)",
                              borderRadius: "var(--r-xs)",
                              cursor: "pointer",
                              background: "none",
                              flexShrink: 0
                            }}
                          />
                          <input
                            value={properties.backgroundColor}
                            onChange={(event) =>
                              onElementEdit({
                                styles: { background: event.target.value },
                              })
                            }
                            style={{
                              flex: 1,
                              minWidth: 0,
                              ...dirtyStyle(isFieldDirty(primary.path, "style", "background")),
                            }}
                          />
                        </div>
                      </Field>
                      <Field label="Opacity">
                        <input
                          value={properties.opacity}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { opacity: event.target.value },
                            })
                          }
                          style={dirtyStyle(isFieldDirty(primary.path, "style", "opacity"))}
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="inspector-section" style={sectionStyle}>
                    <div className="section-label">
                      <LayoutDashboard size={13} />
                      <span>Layout</span>
                    </div>
                    <div className="property-list">
                      <Property
                        label="Size"
                        value={`${properties.width} × ${properties.height}`}
                      />
                      <Property
                        label="Page pos."
                        value={`${properties.pageX}, ${properties.pageY}`}
                      />
                      <Property
                        label="Doc pos."
                        value={`${properties.documentX}, ${properties.documentY}`}
                      />
                      <Property label="Margin" value={properties.margin} />
                      <Property label="Padding" value={properties.padding} />
                      <Property label="Border" value={properties.border} />
                      <Property label="Position" value={properties.position} />
                      <Property
                        label="Transform"
                        value={properties.transform || "none"}
                      />
                    </div>
                    <div className="field-grid">
                      <Field label="Width">
                        <input
                          value={properties.width}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { width: event.target.value },
                            })
                          }
                          onBlur={(event) => {
                            const formatted = formatStyleValue(event.target.value);
                            if (formatted !== event.target.value) {
                              onElementEdit({
                                styles: { width: formatted },
                              });
                            }
                          }}
                          style={dirtyStyle(isFieldDirty(primary.path, "style", "width"))}
                        />
                      </Field>
                      <Field label="Height">
                        <input
                          value={properties.height}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { height: event.target.value },
                            })
                          }
                          onBlur={(event) => {
                            const formatted = formatStyleValue(event.target.value);
                            if (formatted !== event.target.value) {
                              onElementEdit({
                                styles: { height: formatted },
                              });
                            }
                          }}
                          style={dirtyStyle(isFieldDirty(primary.path, "style", "height"))}
                        />
                      </Field>
                    </div>
                  </section>

                  {/* CSS Classes Editor (Item 36) */}
                  <section className="inspector-section" style={sectionStyle}>
                    <div className="section-label">CSS Classes</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                      {(() => {
                        const classList = properties.class ? properties.class.split(/\s+/).filter(Boolean) : [];
                        const isClassDirty = isFieldDirty(primary.path, "attribute", "class");
                        return (
                          <>
                            {classList.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {classList.map((cls) => (
                                  <span
                                    key={cls}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 6px",
                                      background: "var(--bg-hover)",
                                      border: "1px solid var(--border-soft)",
                                      borderRadius: "99px",
                                      fontSize: "10px",
                                      color: "var(--text-2)",
                                    }}
                                  >
                                    {cls}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextClasses = classList.filter((c) => c !== cls).join(" ");
                                        onElementEdit({
                                          attributes: { class: nextClasses || null },
                                        });
                                      }}
                                      style={{
                                        border: "none",
                                        background: "none",
                                        color: "var(--text-4)",
                                        cursor: "pointer",
                                        fontSize: "9px",
                                        padding: "0 2px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "var(--danger)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "var(--text-4)";
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <small style={{ color: "var(--text-4)", fontSize: "10.5px" }}>No classes applied</small>
                            )}

                            <div style={{ display: "flex", gap: "6px" }}>
                              <input
                                id="add-class-input"
                                placeholder="Add class..."
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  ...dirtyStyle(isClassDirty),
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    const val = event.currentTarget.value.trim();
                                    if (val && !classList.includes(val)) {
                                      const nextClasses = [...classList, val].join(" ");
                                      onElementEdit({
                                        attributes: { class: nextClasses },
                                      });
                                      event.currentTarget.value = "";
                                    }
                                  }
                                }}
                              />
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  const input = document.getElementById("add-class-input") as HTMLInputElement | null;
                                  const val = input?.value.trim();
                                  if (val && !classList.includes(val)) {
                                    const nextClasses = [...classList, val].join(" ");
                                    onElementEdit({
                                      attributes: { class: nextClasses },
                                    });
                                    if (input) input.value = "";
                                  }
                                }}
                                style={{ minHeight: "24px", height: "24px" }}
                              >
                                Add
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </section>

                  {/* Identity Section (Item 45) */}
                  <section className="inspector-section" style={sectionStyle}>
                    <div className="section-label">Identity</div>
                    
                    <Field label="Component name">
                      <input
                        value={properties.label}
                        onChange={(event) =>
                          onElementEdit({
                            attributes: {
                              "data-component": event.target.value,
                            },
                          })
                        }
                        style={dirtyStyle(isFieldDirty(primary.path, "attribute", "data-component"))}
                      />
                    </Field>

                    <Field label="Stable ID (data-hdv-id)">
                      <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                        <input
                          value={properties.hdvId}
                          placeholder="No stable ID set"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            ...dirtyStyle(isFieldDirty(primary.path, "attribute", "data-hdv-id")),
                          }}
                          onChange={(event) =>
                            onElementEdit({
                              attributes: { "data-hdv-id": event.target.value || null },
                            })
                          }
                        />
                        {!properties.hdvId && (
                          <Button
                            variant="secondary"
                            style={{ padding: "0 8px", flexShrink: 0, minHeight: "24px", height: "24px" }}
                            onClick={() => {
                              const generatedId = `${properties.tag}-${properties.label
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/^-+|-+$/g, "")}`;
                              onElementEdit({
                                attributes: { "data-hdv-id": generatedId },
                              });
                            }}
                          >
                            Generate ID
                          </Button>
                        )}
                      </div>
                    </Field>
                  </section>
                </>
              ),
            )}

          {/* ── DOCUMENT TAB ──────────────────────────────────── */}
          {activeTab === "document" &&
            renderScrollContent(
              <>
                <section
                  className="inspector-section"
                  style={docSetupSectionStyle}
                >
                  <div className="section-label">
                    <FileSliders size={13} />
                    <span>Page setup</span>
                  </div>
                  <DocumentControls
                    settings={settings}
                    onChange={onSettingsChange}
                    layout="stacked"
                  />
                </section>
                <section className="inspector-section" style={sectionStyle}>
                  <div className="section-label">
                    <Sliders size={13} />
                    <span>Global Styles</span>
                  </div>
                  <Field label="Custom Document CSS (Non-inline)">
                    <textarea
                      value={pendingGlobalStyle !== null ? pendingGlobalStyle : globalStyle}
                      rows={12}
                      onChange={(event) => {
                        onGlobalStyleChange?.(event.target.value);
                      }}
                      style={{
                        fontFamily: '"JetBrains Mono", "SF Mono", monospace',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        background: 'var(--bg-input)',
                        color: 'var(--text-1)',
                        border: pendingGlobalStyle !== null ? '1px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '8px',
                        width: '100%',
                        resize: 'vertical',
                      }}
                    />
                  </Field>
                </section>
                <section className="inspector-section" style={sectionStyle}>
                  <div className="section-label">Current values</div>
                  <div className="property-list">
                    <Property
                      label="Page"
                      value={`${settings.pageSizePreset} ${settings.orientation}`}
                    />
                    <Property
                      label="Margins"
                      value={`${settings.marginTop} ${settings.marginRight} ${settings.marginBottom} ${settings.marginLeft}`}
                    />
                    <Property
                      label="Background"
                      value={settings.backgroundColor}
                    />
                    <Property
                      label="State"
                      value={
                        settingsDirty ? "Unsaved document settings" : "Saved"
                      }
                    />
                  </div>
                </section>
              </>,
            )}

          {/* ── LIBRARY TAB ────────────────────────────────────── */}
          {activeTab === "library" &&
            renderScrollContent(
              <>
                <section className="inspector-section" style={sectionStyle}>
                  <div className="section-label">
                    <Library size={13} />
                    <span>Save as component</span>
                  </div>
                  <Field label="Component name">
                    <input
                      value={templateName}
                      onChange={(event) =>
                        onTemplateNameChange(event.target.value)
                      }
                      placeholder={
                        selectedItems.length > 1
                          ? `Group of ${selectedItems.length} components…`
                          : "Name this component…"
                      }
                    />
                  </Field>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={inlineTemplateStyles}
                      onChange={(event) =>
                        onInlineTemplateStylesChange(event.target.checked)
                      }
                    />
                    <span>Inline computed styles for cross-document reuse</span>
                  </label>
                  <Button
                    variant="primary"
                    disabled={!selectedItems.length}
                    onClick={onSaveTemplate}
                  >
                    Save as component
                  </Button>
                </section>

                <section
                  className="inspector-section component-library"
                  style={librarySectionStyle}
                >
                  <div className="section-label">
                    Library
                    {filteredTemplates.length > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 99,
                          background: "var(--accent-muted)",
                          color: "var(--accent-bright)",
                          letterSpacing: 0,
                          textTransform: "none",
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
                    onChange={(event) =>
                      onLibrarySearchChange(event.target.value)
                    }
                    placeholder="Search components…"
                    style={{ marginBottom: 0 }}
                  />
                  <div
                    className="component-list"
                    style={undefined}
                  >
                    {filteredTemplates.map((template) => (
                      <button
                        type="button"
                        key={template.id}
                        className={
                          template.id === selectedTemplateId
                            ? "component-card component-card--active"
                            : "component-card"
                        }
                        onClick={() => onSelectedTemplateChange(template.id)}
                        onContextMenu={(e) =>
                          onTemplateContextMenu?.(e, template)
                        }
                      >
                        <strong>{template.name}</strong>
                        <span>{template.previewText || "No text preview"}</span>
                        <small>
                          {template.sourceDocumentPath || "Saved component"}
                        </small>
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

                <section className="inspector-section" style={sectionStyle}>
                  <div className="section-label">Insert & manage</div>
                  <div className="field-grid">
                    <Field label="Placement">
                      <select
                        value={templatePlacement}
                        onChange={(event) =>
                          onTemplatePlacementChange(event.target.value)
                        }
                      >
                        <option value="after">After</option>
                        <option value="before">Before</option>
                        <option value="inside-end">Inside end</option>
                        <option value="inside-start">Inside start</option>
                      </select>
                    </Field>
                    <Field label="Selected">
                      <input
                        value={selectedTemplate?.name || ""}
                        readOnly
                        placeholder="Choose component"
                      />
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
                      onChange={(event) =>
                        onRenameTemplateNameChange(event.target.value)
                      }
                      placeholder={
                        selectedTemplate?.name || "Choose a component first"
                      }
                    />
                  </Field>
                  <div className="split-actions">
                    <Button
                      variant="secondary"
                      disabled={
                        !selectedTemplateId || !renameTemplateName.trim()
                      }
                      onClick={onRenameTemplate}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!selectedTemplateId}
                      onClick={onDeleteTemplate}
                    >
                      <Trash2 size={13} />
                      Delete
                    </Button>
                  </div>
                </section>
              </>,
            )}
        </div>
        <div className="inspector-footer">
            <span>
              {pendingChangeCount} pending edit
              {pendingChangeCount !== 1 ? "s" : ""}
            </span>
            <span>
              {settings.pageSizePreset} / {settings.orientation}
            </span>
          </div>
      </div>
    </div>
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="property-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function breadcrumbFor(item: SelectionItem) {
  const label = item.properties?.label || item.tag;
  const quoteIdx = label.indexOf(' "');
  const formatted = quoteIdx !== -1 ? label.substring(0, quoteIdx) : label;
  return `${formatted} › ${item.path}`;
}




function isStandardFont(font: string) {
  if (!font) return true;
  const normalized = font.replace(/['"]/g, "").toLowerCase();
  const standards = [
    "system-ui, -apple-system, sans-serif",
    "inter, sans-serif",
    "jetbrains mono, monospace",
    "arial, sans-serif",
    "georgia, serif",
    "courier new, monospace",
    "times new roman, serif",
  ];
  return standards.some(
    (std) =>
      normalized.includes(std.replace(/['"]/g, "").toLowerCase()) ||
      std.split(",")[0].trim() === normalized.split(",")[0].trim()
  );
}

function getSelectableFontFamily(font: string) {
  if (!font) return "";
  const normalized = font.replace(/['"]/g, "").toLowerCase();
  const mapping: Record<string, string> = {
    "system-ui": "system-ui, -apple-system, sans-serif",
    "inter": "Inter, sans-serif",
    "jetbrains mono": "JetBrains Mono, monospace",
    "arial": "Arial, sans-serif",
    "georgia": "Georgia, serif",
    "courier new": "Courier New, monospace",
    "times new roman": "Times New Roman, serif",
  };
  for (const [key, val] of Object.entries(mapping)) {
    if (normalized.includes(key)) {
      return val;
    }
  }
  return font;
}

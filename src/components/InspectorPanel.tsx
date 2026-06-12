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
  HorizontalScrollContainer,
  Badge,
} from "./ui";

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
  isBottomDocked?: boolean;
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
  isBottomDocked = false,
}: InspectorPanelProps) {
  const primary = selectedItems[0];
  const properties = primary?.properties;
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
    if (isBottomDocked) {
      return (
        <HorizontalScrollContainer style={{ flex: 1, height: "100%" }}>
          {children}
        </HorizontalScrollContainer>
      );
    }
    return <div className="inspector-scroll">{children}</div>;
  };

  const sectionStyle = isBottomDocked
    ? {
        borderBottom: "none",
        borderRight: "1px solid var(--border-dim)",
        flexShrink: 0,
        width: 240,
        display: "flex",
        flexDirection: "column" as const,
        gap: 8,
        alignSelf: "flex-start" as const,
        overflow: "visible" as const,
      }
    : undefined;

  const docSetupSectionStyle = isBottomDocked
    ? {
        borderBottom: "none",
        borderRight: "1px solid var(--border-dim)",
        flexShrink: 0,
        width: "auto",
        display: "flex",
        flexDirection: "column" as const,
        gap: 8,
        justifyContent: "flex-start" as const,
        alignSelf: "flex-start" as const,
        overflow: "visible" as const,
      }
    : undefined;

  const librarySectionStyle = isBottomDocked
    ? {
        borderBottom: "none",
        borderRight: "1px solid var(--border-dim)",
        flexShrink: 0,
        width: 240,
        display: "flex",
        flexDirection: "column" as const,
        gap: 8,
        alignSelf: "flex-start" as const,
        overflow: "visible" as const,
      }
    : undefined;

  if (isBottomDocked) {
    return (
      <div
        className="inspector-panel-bottom"
        style={{
          display: "flex",
          flexDirection: "row",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={onTabChange}
          orientation="vertical"
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

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {/* TAB: SELECTION */}
          {activeTab === "selection" &&
            (!properties ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  width: "100%",
                  padding: "16px",
                }}
              >
                <EmptyState
                  title="No component selected"
                  body="Enable Select mode and click any element in the document to inspect it."
                />
              </div>
            ) : (
              <HorizontalScrollContainer
                style={{ flex: 1, height: "100%" }}
                contentAlignItems="flex-start"
                navigation="scrollbar"
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "24px",
                    padding: "16px 24px",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Identity Card */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      minWidth: "240px",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            color: "var(--text-3)",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Identity
                        </span>
                        <strong
                          style={{
                            fontSize: "13px",
                            color: "var(--text-1)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "180px",
                          }}
                        >
                          {selectedItems.length > 1
                            ? `${selectedItems.length} components`
                            : properties.label}
                        </strong>
                        <small
                          style={{ color: "var(--text-3)", fontSize: "10px" }}
                        >
                          {selectedItems.length > 1
                            ? "Batch editing"
                            : breadcrumbFor(primary)}
                        </small>
                      </div>
                      <IconButton
                        title="Copy agent references"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            selectedItems
                              .map((item) => item.agentReference)
                              .join("\n"),
                          )
                        }
                        style={{ width: "28px", height: "28px" }}
                      >
                        <Copy size={14} />
                      </IconButton>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "60px",
                          flexShrink: 0,
                        }}
                      >
                        Name
                      </span>
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        defaultValue={primary.label}
                        onBlur={(event) =>
                          onElementEdit({
                            attributes: {
                              "data-component": event.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Text Content Card */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      minWidth: "280px",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        color: "var(--text-3)",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Text content
                    </span>
                    <textarea
                      style={{
                        width: "100%",
                        height: "80px",
                        fontSize: "11px",
                        resize: "none",
                        padding: "6px",
                        minHeight: "80px",
                      }}
                      value={properties.text}
                      onChange={(event) =>
                        onElementEdit({ textContent: event.target.value })
                      }
                    />
                  </div>

                  {/* Typography & Style Card */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      minWidth: "280px",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        color: "var(--text-3)",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Typography & Fill
                    </span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-2)",
                            width: "50px",
                            flexShrink: 0,
                          }}
                        >
                          Size
                        </span>
                        <input
                          style={{ flex: 1, height: "24px", fontSize: "11px" }}
                          value={properties.fontSize}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { "font-size": event.target.value },
                            })
                          }
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-2)",
                            width: "50px",
                            flexShrink: 0,
                          }}
                        >
                          Color
                        </span>
                        <input
                          style={{ flex: 1, height: "24px", fontSize: "11px" }}
                          value={properties.color}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { color: event.target.value },
                            })
                          }
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-2)",
                            width: "50px",
                            flexShrink: 0,
                          }}
                        >
                          Bg
                        </span>
                        <input
                          style={{ flex: 1, height: "24px", fontSize: "11px" }}
                          value={properties.backgroundColor}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { background: event.target.value },
                            })
                          }
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-2)",
                            width: "50px",
                            flexShrink: 0,
                          }}
                        >
                          Opacity
                        </span>
                        <input
                          style={{ flex: 1, height: "24px", fontSize: "11px" }}
                          value={properties.opacity}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { opacity: event.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Layout & Dimensions Card */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      minWidth: "420px",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        color: "var(--text-3)",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Layout & Size
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          width: "120px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-2)",
                              width: "40px",
                              flexShrink: 0,
                            }}
                          >
                            Width
                          </span>
                          <input
                            style={{
                              flex: 1,
                              height: "24px",
                              fontSize: "11px",
                            }}
                            value={properties.width}
                            onChange={(event) =>
                              onElementEdit({
                                styles: { width: event.target.value },
                              })
                            }
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-2)",
                              width: "40px",
                              flexShrink: 0,
                            }}
                          >
                            Height
                          </span>
                          <input
                            style={{
                              flex: 1,
                              height: "24px",
                              fontSize: "11px",
                            }}
                            value={properties.height}
                            onChange={(event) =>
                              onElementEdit({
                                styles: { height: event.target.value },
                              })
                            }
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          flex: 1,
                          background: "rgba(0,0,0,0.15)",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          minWidth: "260px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            flex: 1,
                          }}
                        >
                          <BottomProperty
                            label="Size"
                            value={`${properties.width}×${properties.height}`}
                          />
                          <BottomProperty
                            label="Page"
                            value={`${properties.pageX},${properties.pageY}`}
                          />
                          <BottomProperty
                            label="Doc"
                            value={`${properties.documentX},${properties.documentY}`}
                          />
                          <BottomProperty
                            label="Pos"
                            value={properties.position}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            flex: 1,
                          }}
                        >
                          <BottomProperty
                            label="Margin"
                            value={properties.margin || "0"}
                          />
                          <BottomProperty
                            label="Padding"
                            value={properties.padding || "0"}
                          />
                          <BottomProperty
                            label="Border"
                            value={properties.border || "0"}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </HorizontalScrollContainer>
            ))}

          {/* TAB: DOCUMENT */}
          {activeTab === "document" && (
            <HorizontalScrollContainer
              style={{ flex: 1, height: "100%" }}
              contentAlignItems="flex-start"
              navigation="scrollbar"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "24px",
                  padding: "16px 24px",
                  alignItems: "flex-start",
                }}
              >
                {/* Page Setup Card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: "380px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Page Setup
                  </span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "60px",
                          flexShrink: 0,
                        }}
                      >
                        Preset
                      </span>
                      <select
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.pageSizePreset}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            pageSizePreset: event.target
                              .value as DocumentSettings["pageSizePreset"],
                          })
                        }
                      >
                        <option value="A4">A4</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "70px",
                          flexShrink: 0,
                        }}
                      >
                        Orientation
                      </span>
                      <select
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.orientation}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            orientation: event.target
                              .value as DocumentSettings["orientation"],
                          })
                        }
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "60px",
                          flexShrink: 0,
                        }}
                      >
                        Width
                      </span>
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.width}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            width: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "70px",
                          flexShrink: 0,
                        }}
                      >
                        Height
                      </span>
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.height}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            height: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Page Margins Card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: "280px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Margins
                  </span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "50px",
                          flexShrink: 0,
                        }}
                      >
                        Top
                      </span>
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.marginTop}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            marginTop: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "50px",
                          flexShrink: 0,
                        }}
                      >
                        Right
                      </span>
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.marginRight}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            marginRight: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "50px",
                          flexShrink: 0,
                        }}
                      >
                        Bottom
                      </span>
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.marginBottom}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            marginBottom: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-2)",
                          width: "50px",
                          flexShrink: 0,
                        }}
                      >
                        Left
                      </span>
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.marginLeft}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            marginLeft: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Page Style / Background Card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: "220px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Background
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{ fontSize: "11px", color: "var(--text-2)" }}
                      >
                        Color
                      </span>
                      <input
                        type="color"
                        style={{
                          width: "40px",
                          height: "24px",
                          padding: 0,
                          border: "none",
                          cursor: "pointer",
                        }}
                        value={
                          settings.backgroundColor.startsWith("#")
                            ? settings.backgroundColor
                            : "#ffffff"
                        }
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            backgroundColor: event.target.value,
                          })
                        }
                      />
                      <input
                        style={{ flex: 1, height: "24px", fontSize: "11px" }}
                        value={settings.backgroundColor}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            backgroundColor: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--text-3)",
                        background: "rgba(0,0,0,0.12)",
                        padding: "6px",
                        borderRadius: "4px",
                        marginTop: "4px",
                      }}
                    >
                      State:{" "}
                      <strong
                        style={{
                          color: settingsDirty
                            ? "var(--warning)"
                            : "var(--success)",
                        }}
                      >
                        {settingsDirty ? "Unsaved changes" : "Saved"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </HorizontalScrollContainer>
          )}

          {/* TAB: LIBRARY */}
          {activeTab === "library" && (
            <HorizontalScrollContainer
              style={{ flex: 1, height: "100%" }}
              contentAlignItems="flex-start"
              navigation="scrollbar"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "24px",
                  padding: "16px 24px",
                  alignItems: "flex-start",
                  height: "100%",
                }}
              >
                {/* Save component card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: "260px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Save Selection
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <input
                      style={{
                        height: "26px",
                        fontSize: "11px",
                        width: "100%",
                      }}
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
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "10px",
                        color: "var(--text-2)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={inlineTemplateStyles}
                        onChange={(event) =>
                          onInlineTemplateStylesChange(event.target.checked)
                        }
                      />
                      <span>Inline computed styles</span>
                    </label>
                    <Button
                      variant="primary"
                      disabled={!selectedItems.length}
                      onClick={onSaveTemplate}
                      style={{
                        height: "26px",
                        fontSize: "11px",
                        padding: "0 12px",
                      }}
                    >
                      Save component
                    </Button>
                  </div>
                </div>

                {/* Component list / Search card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    width: "280px",
                    flexShrink: 0,
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        color: "var(--text-3)",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Library
                    </span>
                    {filteredTemplates.length > 0 && (
                      <Badge
                        variant="accent"
                        style={{ fontSize: "9px", padding: "1px 5px" }}
                      >
                        {filteredTemplates.length}
                      </Badge>
                    )}
                  </div>
                  <input
                    style={{ height: "26px", fontSize: "11px", width: "100%" }}
                    value={librarySearch}
                    onChange={(event) =>
                      onLibrarySearchChange(event.target.value)
                    }
                    placeholder="Search components…"
                  />
                  <div
                    className="hide-scrollbar"
                    style={
                      isBottomDocked
                        ? {
                            flex: 1,
                            overflowX: "auto",
                            overflowY: "hidden",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: "6px",
                            background: "rgba(0,0,0,0.12)",
                            padding: "4px",
                            borderRadius: "4px",
                            height: "auto",
                            minHeight: "80px",
                          }
                        : {
                            flex: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            background: "rgba(0,0,0,0.12)",
                            padding: "4px",
                            borderRadius: "4px",
                            height: "80px",
                          }
                    }
                  >
                    {filteredTemplates.length === 0 ? (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-3)",
                          padding: "8px",
                          textAlign: "center",
                        }}
                      >
                        No components found
                      </div>
                    ) : (
                      filteredTemplates.map((template) => (
                        <button
                          type="button"
                          key={template.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            width: isBottomDocked ? "180px" : "100%",
                            minWidth: isBottomDocked ? "180px" : undefined,
                            padding: "4px 8px",
                            borderRadius: "3px",
                            border: "none",
                            textAlign: "left",
                            cursor: "pointer",
                            background:
                              template.id === selectedTemplateId
                                ? "var(--accent-bright)"
                                : "transparent",
                            color:
                              template.id === selectedTemplateId
                                ? "#fff"
                                : "var(--text-1)",
                            fontSize: "11px",
                            flexShrink: 0,
                          }}
                          onClick={() => onSelectedTemplateChange(template.id)}
                          onContextMenu={(e) =>
                            onTemplateContextMenu?.(e, template)
                          }
                        >
                          <strong style={{ fontSize: "11px" }}>
                            {template.name}
                          </strong>
                          <span
                            style={{
                              fontSize: "9px",
                              opacity: 0.8,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "100%",
                            }}
                          >
                            {template.previewText || "No text preview"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Component Actions card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    width: "220px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Actions
                  </span>
                  <Button
                    variant="primary"
                    disabled={!selectedTemplateId || !selectedItems.length}
                    onClick={onInsertTemplate}
                    style={{ height: "26px", fontSize: "11px", width: "100%" }}
                  >
                    Insert component
                  </Button>
                  <div
                    style={{ height: "1px", background: "var(--border-dim)" }}
                  />
                  <input
                    style={{ height: "24px", fontSize: "11px", width: "100%" }}
                    value={renameTemplateName}
                    onChange={(event) =>
                      onRenameTemplateNameChange(event.target.value)
                    }
                    placeholder={selectedTemplate?.name || "Rename component…"}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Button
                      variant="secondary"
                      disabled={
                        !selectedTemplateId || !renameTemplateName.trim()
                      }
                      onClick={onRenameTemplate}
                      style={{
                        flex: 1,
                        height: "24px",
                        fontSize: "11px",
                        padding: 0,
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!selectedTemplateId}
                      onClick={onDeleteTemplate}
                      style={{
                        flex: 1,
                        height: "24px",
                        fontSize: "11px",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      <Trash2 size={11} />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </HorizontalScrollContainer>
          )}
        </div>
      </div>
    );
  }

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
                          {selectedItems.length > 1
                            ? "Batch editing shared fields"
                            : breadcrumbFor(primary)}
                        </small>
                      </div>
                      <IconButton
                        title="Copy agent references to clipboard"
                        onClick={() =>
                          navigator.clipboard.writeText(
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
                        rows={isBottomDocked ? 2 : 3}
                        onChange={(event) =>
                          onElementEdit({ textContent: event.target.value })
                        }
                      />
                    </Field>
                  </section>

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
                        />
                      </Field>
                      <Field label="Color">
                        <input
                          value={properties.color}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { color: event.target.value },
                            })
                          }
                        />
                      </Field>
                      <Field label="Background">
                        <input
                          value={properties.backgroundColor}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { background: event.target.value },
                            })
                          }
                        />
                      </Field>
                      <Field label="Opacity">
                        <input
                          value={properties.opacity}
                          onChange={(event) =>
                            onElementEdit({
                              styles: { opacity: event.target.value },
                            })
                          }
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
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="inspector-section" style={sectionStyle}>
                    <div className="section-label">Identity</div>
                    <Field label="Component name">
                      <input
                        defaultValue={primary.label}
                        onBlur={(event) =>
                          onElementEdit({
                            attributes: {
                              "data-component": event.target.value,
                            },
                          })
                        }
                      />
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
                    layout={isBottomDocked ? "compact" : "stacked"}
                  />
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
                    style={
                      isBottomDocked
                        ? { flex: 1, minHeight: 0, overflowY: "auto" }
                        : undefined
                    }
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
        {!isBottomDocked && (
          <div className="inspector-footer">
            <span>
              {pendingChangeCount} pending edit
              {pendingChangeCount !== 1 ? "s" : ""}
            </span>
            <span>
              {settings.pageSizePreset} / {settings.orientation}
            </span>
          </div>
        )}
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
  return `${item.tag} › ${item.path}`;
}

function BottomProperty({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "10px",
        gap: "8px",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        padding: "2px 0",
      }}
    >
      <span style={{ color: "var(--text-3)", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <strong
        style={{
          color: "var(--text-1)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

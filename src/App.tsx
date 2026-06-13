/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Globe2,
  Library,
  MousePointer2,
  RefreshCw,
  Save,
  RotateCcw,
  Search,
  Sliders,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
  Plus,
  Maximize2,
  Undo,
  Redo,
  Copy,
} from "lucide-react";
import "./App.css";
import { DockviewReact, DockviewApi } from "dockview-react";
import type { DockviewReadyEvent } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { api, getStoredToken, setStoredToken } from "./api";
import {
  DocumentFrame,
  type DocumentFrameHandle,
} from "./components/DocumentFrame";
import { InspectorPanel, type InspectorTab } from "./components/InspectorPanel";
import { triggerConfetti, toast, formatBreadcrumb, copyToClipboard } from "./lib/utils";
import { DEFAULT_SETTINGS, resolvePageSize, cssLengthToPx } from "./lib/documentSettings";
import { mergeEdits } from "./lib/panel-layouts";
import {
  IconButton,
  ContextMenu,
  type ContextMenuItem,
  ToastContainer,
  Dialog,
  NewDocumentModal,
} from "./components/ui";
import type {
  DocumentDetail,
  DocumentSettings,
  DocumentSummary,
  ElementEdit,
  SelectionItem,
  TemplateRecord,
} from "./types";

import { createContext, useContext } from "react";
import { LibraryScreen } from "./components/LibraryScreen";
import { SettingsScreen } from "./components/SettingsScreen";

const AppContext = createContext<any>(null);

function App() {
  const frameRef = useRef<DocumentFrameHandle | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const [fipCopyNotice, setFipCopyNotice] = useState("");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeDocument, setActiveDocument] = useState<DocumentDetail | null>(
    null,
  );
  const [settings, setSettings] = useState<DocumentSettings>(DEFAULT_SETTINGS);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [globalStyle, setGlobalStyle] = useState<string>("");
  const [pendingGlobalStyle, setPendingGlobalStyle] = useState<string | null>(null);

  interface HistorySnapshot {
    pendingEdits: Record<string, ElementEdit>;
    settings: DocumentSettings;
    settingsDirty: boolean;
    pendingGlobalStyle: string | null;
  }
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushToHistory = (
    nextPendingEdits: Record<string, ElementEdit>,
    nextSettings: DocumentSettings,
    nextSettingsDirty: boolean,
    nextPendingGlobalStyle: string | null,
    immediate = false
  ) => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }

    const snapshot: HistorySnapshot = {
      pendingEdits: JSON.parse(JSON.stringify(nextPendingEdits)),
      settings: { ...nextSettings },
      settingsDirty: nextSettingsDirty,
      pendingGlobalStyle: nextPendingGlobalStyle,
    };

    const runPush = () => {
      setPast((prev) => {
        const next = [...prev, snapshot];
        if (next.length > 50) {
          next.shift();
        }
        return next;
      });
      setFuture([]);
    };

    if (immediate) {
      runPush();
    } else {
      historyTimeoutRef.current = setTimeout(runPush, 500);
    }
  };

  const canUndo = past.length > 1;
  const canRedo = future.length > 0;

  const undo = () => {
    if (past.length <= 1) return;
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
    const current = past[past.length - 1];
    const previous = past[past.length - 2];

    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, current]);

    setPendingEdits(previous.pendingEdits);
    setSettings(previous.settings);
    setSettingsDirty(previous.settingsDirty);
    setPendingGlobalStyle(previous.pendingGlobalStyle);

    setReloadToken((value) => value + 1);
  };

  const redo = () => {
    if (future.length === 0) return;
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
    const next = future[future.length - 1];

    setPast((prev) => [...prev, next]);
    setFuture((prev) => prev.slice(0, -1));

    setPendingEdits(next.pendingEdits);
    setSettings(next.settings);
    setSettingsDirty(next.settingsDirty);
    setPendingGlobalStyle(next.pendingGlobalStyle);

    setReloadToken((value) => value + 1);
  };
  const [selectorEnabled, setSelectorEnabled] = useState(true);
  const [selectedItems, setSelectedItems] = useState<SelectionItem[]>([]);
  const [pendingEdits, setPendingEdits] = useState<Record<string, ElementEdit>>(
    {},
  );
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [inlineTemplateStyles, setInlineTemplateStyles] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatePlacement, setTemplatePlacement] = useState("after");
  const [librarySearch, setLibrarySearch] = useState("");
  const [renameTemplateName, setRenameTemplateName] = useState("");
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<InspectorTab>("selection");
  const [tokenInput, setTokenInput] = useState(getStoredToken());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading documents…");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeView, setActiveView] = useState<
    "editor" | "library" | "settings"
  >("editor");
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);

  const slideDeckMode = settings.pageSizePreset === "Slide16_9";
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [discoveredSlides, setDiscoveredSlides] = useState<
    Array<{ id: string; name: string; elementIndex: number }>
  >([]);
  const [slideScale, setSlideScale] = useState(1.0);
  const [docScale, setDocScale] = useState(1.0);
  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [infoPanelVisible, setInfoPanelVisible] = useState(false);

  const leftDockWidth = 220;
  const rightDockWidth = 280;

  const onReady = (event: DockviewReadyEvent) => {
    setDockviewApi(event.api);

    const saved = localStorage.getItem("hdv-dockview-layout");
    if (saved) {
      try {
        event.api.fromJSON(JSON.parse(saved));
      } catch {
        setupDefaultLayout(event.api);
      }
    } else {
      setupDefaultLayout(event.api);
    }

    event.api.onDidLayoutChange(() => {
      const sidebar = event.api.getPanel("sidebar");
      const inspector = event.api.getPanel("inspector");
      const infoPanel = event.api.getPanel("infoPanel");

      setSidebarVisible(!!sidebar && sidebar.api.isVisible);
      setInspectorVisible(!!inspector && inspector.api.isVisible);
      setInfoPanelVisible(!!infoPanel && infoPanel.api.isVisible);

      const layout = event.api.toJSON();
      localStorage.setItem("hdv-dockview-layout", JSON.stringify(layout));
    });
  };

  const setupDefaultLayout = (api: DockviewApi) => {
    api.clear();

    api.addPanel({
      id: "canvas",
      component: "canvas",
      title: "Canvas",
    });

    api.addPanel({
      id: "sidebar",
      component: "sidebar",
      title: "Navigator",
      position: {
        referencePanel: "canvas",
        direction: "left",
      },
      initialWidth: 220,
      minimumWidth: 180,
    });

    api.addPanel({
      id: "inspector",
      component: "inspector",
      title: "Inspector",
      position: {
        referencePanel: "canvas",
        direction: "right",
      },
      initialWidth: 280,
      minimumWidth: 240,
    });
  };

  const togglePanelVisible = (id: string) => {
    if (!dockviewApi) return;
    const panel = dockviewApi.getPanel(id);
    if (panel) {
      panel.api.close();
    } else {
      if (id === "sidebar") {
        dockviewApi.addPanel({
          id: "sidebar",
          component: "sidebar",
          title: "Navigator",
          position: {
            referencePanel: "canvas",
            direction: "left",
          },
          initialWidth: 220,
          minimumWidth: 180,
        });
      } else if (id === "inspector") {
        dockviewApi.addPanel({
          id: "inspector",
          component: "inspector",
          title: "Inspector",
          position: {
            referencePanel: "canvas",
            direction: "right",
          },
          initialWidth: 280,
          minimumWidth: 240,
        });
      } else if (id === "infoPanel") {
        dockviewApi.addPanel({
          id: "infoPanel",
          component: "infoPanel",
          title: "Selection References",
          floating: {
            x: 300,
            y: window.innerHeight - 250,
            width: 320,
            height: 180,
          },
        });
      }
    }
  };

  const [destinationsExpanded, setDestinationsExpanded] = useState(() => {
    const v = localStorage.getItem("hdv-acc-destinations");
    return v === null ? true : v === "true";
  });
  const [documentsExpanded, setDocumentsExpanded] = useState(() => {
    const v = localStorage.getItem("hdv-acc-documents");
    return v === null ? true : v === "true";
  });
  const [footerVisible, setFooterVisible] = useState(true);
  const [topbarMaximized, setTopbarMaximized] = useState(false);
  const [saveBtnFlash, setSaveBtnFlash] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => {
      setFooterVisible(true);
    }, 0);
    const hideTimer = setTimeout(() => {
      setFooterVisible(false);
    }, 3000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [status]);

  const [accent, setAccent] = useState<
    "blue" | "purple" | "teal" | "orange" | "rose"
  >(() => {
    return (
      (localStorage.getItem("hdv-accent") as
        | "blue"
        | "purple"
        | "teal"
        | "orange"
        | "rose") || "blue"
    );
  });
  const [theme, setTheme] = useState<
    "system" | "dark" | "light" | "true-black"
  >(() => {
    return (
      (localStorage.getItem("hdv-theme") as
        | "system"
        | "dark"
        | "light"
        | "true-black") || "system"
    );
  });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [startupActive, setStartupActive] = useState(() => {
    return typeof navigator !== "undefined" && navigator.webdriver
      ? false
      : true;
  });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0 });
  const [zenMode, setZenMode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStartupActive(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const fitToWorkspaceRef = useRef<() => void>(() => {});
  const fitDocumentToWorkspaceRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!activeDocument) return;
    const frame = frameRef.current?.getShellElement();
    if (!frame) return;
    const workspace = frame.parentElement;
    if (!workspace) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    
    const fitToWorkspace = () => {
      const resolved = resolvePageSize(settings);
      const pageWidth = cssLengthToPx(resolved.width);
      const pageHeight = cssLengthToPx(resolved.height);
      if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) {
        return;
      }
      const styles = window.getComputedStyle(workspace);
      const padX = parseFloat(styles.paddingLeft || "0") + parseFloat(styles.paddingRight || "0");
      const padY = parseFloat(styles.paddingTop || "0") + parseFloat(styles.paddingBottom || "0");
      const availableW = workspace.clientWidth - padX;
      const availableH = workspace.clientHeight - padY;
      if (availableW <= 0 || availableH <= 0) return;
      const fit = Math.min(availableW / pageWidth, availableH / pageHeight, 1);
      const next = Math.max(0.2, Math.min(2, Number(fit.toFixed(3))));
      setSlideScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    };

    const fitDocumentToWorkspace = () => {
      const resolved = resolvePageSize(settings);
      // Paged.js pages padding (34px left/right = 68px)
      const pageWidth = cssLengthToPx(resolved.width) + 68;
      if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
        return;
      }
      const styles = window.getComputedStyle(workspace);
      const padX = parseFloat(styles.paddingLeft || "0") + parseFloat(styles.paddingRight || "0");
      const availableW = workspace.clientWidth - padX;
      if (availableW <= 0) return;
      const fit = Math.min(availableW / pageWidth, 1);
      const next = Math.max(0.2, Math.min(1.2, Number(fit.toFixed(3))));
      setDocScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    };

    fitToWorkspaceRef.current = fitToWorkspace;
    fitDocumentToWorkspaceRef.current = fitDocumentToWorkspace;

    const fit = () => {
      if (slideDeckMode) {
        fitToWorkspace();
      } else {
        fitDocumentToWorkspace();
      }
    };

    const debouncedFit = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        fit();
      }, 120);
    };

    // Initial fit
    fit();

    // Use ResizeObserver to observe workspace layout changes (e.g. docking sidebar/inspector)
    const observer = new ResizeObserver(() => {
      fit();
    });
    observer.observe(workspace);

    window.addEventListener("resize", debouncedFit);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", debouncedFit);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideDeckMode, activeDocument?.id, settings.pageSizePreset, settings.orientation, settings.width, settings.height]);

  // Disable browser right-click menu globally in the main window
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", handleGlobalContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleGlobalContextMenu);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove(
      "accent-blue",
      "accent-purple",
      "accent-teal",
      "accent-orange",
      "accent-rose",
      "theme-light",
      "theme-true-black",
    );
    document.documentElement.classList.add(`accent-${accent}`);
    localStorage.setItem("hdv-accent", accent);

    const applyTheme = (t: string) => {
      document.documentElement.classList.remove(
        "theme-light",
        "theme-true-black",
      );
      if (t === "light") {
        document.documentElement.classList.add("theme-light");
      } else if (t === "true-black") {
        document.documentElement.classList.add("theme-true-black");
      } else if (t === "system") {
        const isSystemLight = window.matchMedia(
          "(prefers-color-scheme: light)",
        ).matches;
        if (isSystemLight) {
          document.documentElement.classList.add("theme-light");
        }
      }
    };

    applyTheme(theme);
    localStorage.setItem("hdv-theme", theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.remove("theme-light");
        if (e.matches) {
          document.documentElement.classList.add("theme-light");
        }
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [accent, theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future]);

  const [ancestors, setAncestors] = useState<
    Array<{ tag: string; path: string; label: string }>
  >([]);
  const [openDocIds, setOpenDocIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: "confirm" | "alert" | "prompt";
    promptPlaceholder?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (val?: string) => void;
    onCancel: () => void;
  } | null>(null);

  function closeTab(id: string) {
    setOpenDocIds((prev) => {
      const next = prev.filter((docId) => docId !== id);
      if (activeDocument?.id === id) {
        if (next.length > 0) {
          const nextActiveId = next[next.length - 1];
          setTimeout(() => {
            void openDocument(nextActiveId, { force: true });
          }, 0);
        } else {
          setActiveDocument(null);
        }
      }
      return next;
    });
  }

  function closeDocumentTab(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    closeTab(id);
  }

  function handleSelectionChange(items: SelectionItem[]) {
    setSelectedItems(items);
    if (items.length > 0) {
      setActiveInspectorTab("selection");
      if (frameRef.current) {
        setAncestors(frameRef.current.getAncestors(items[0].path));
      }
      if (dockviewApi && !dockviewApi.getPanel("infoPanel")) {
        dockviewApi.addPanel({
          id: "infoPanel",
          component: "infoPanel",
          title: "Selection References",
          floating: {
            x: 300,
            y: window.innerHeight - 250,
            width: 320,
            height: 180,
          },
        });
      }
    } else {
      setAncestors([]);
    }
  }

  const handleFrameContextMenu = (x: number, y: number, path: string) => {
    if (path === "__canvas__") {
      const items: ContextMenuItem[] = [
        {
          label: selectorEnabled ? "Exit Select Mode" : "Enter Select Mode",
          onClick: () => setSelectorEnabled(!selectorEnabled),
        },
        {
          label: zenMode ? "Exit Zen Mode" : "Enter Zen Mode (⌘.)",
          onClick: () => setZenMode(!zenMode),
        },
        { divider: true },
        {
          label: sidebarVisible ? "Hide Sidebar" : "Show Sidebar",
          onClick: () => togglePanelVisible("sidebar"),
        },
        {
          label: inspectorVisible ? "Hide Inspector" : "Show Inspector",
          onClick: () => togglePanelVisible("inspector"),
        },
        { divider: true },
        {
          label: "Refresh Preview",
          onClick: () => setReloadToken((t) => t + 1),
        },
        { divider: true },
        {
          label: "Export HTML",
          onClick: exportHtml,
        },
        {
          label: "Export PDF",
          onClick: exportPdf,
        },
      ];
      setContextMenu({ x, y, items });
      return;
    }

    const isAlreadySelected = selectedItems.some((item) => item.path === path);
    if (!isAlreadySelected && frameRef.current) {
      frameRef.current.selectElementByPath(path);
    }

    const menuSelectedItems = isAlreadySelected
      ? selectedItems
      : [
          {
            path,
            label: "Component",
            agentReference: `HDV_REF file="${activeDocument?.relativePath || ""}" path="${path}"`,
          },
        ];

    const parentPath = path.includes(".")
      ? path.substring(0, path.lastIndexOf("."))
      : "";
    const items: ContextMenuItem[] = [
      {
        label: "Select Parent",
        disabled: !parentPath,
        onClick: () => {
          if (frameRef.current && parentPath) {
            frameRef.current.selectElementByPath(parentPath);
          }
        },
      },
      { divider: true },
      {
        label:
          menuSelectedItems.length > 1 ? "Copy References" : "Copy Reference",
        onClick: () => {
          if (frameRef.current) {
            const refStr =
              menuSelectedItems.length > 1
                ? menuSelectedItems
                    .map((item) => item.agentReference)
                    .join("\n")
                : `HDV_REF file="${activeDocument?.relativePath || ""}" path="${path}"`;
            void copyToClipboard(refStr);
            toast(
              menuSelectedItems.length > 1
                ? "Copied references to clipboard"
                : "Copied reference to clipboard",
              "success",
            );
          }
        },
      },
      {
        label: "Copy Inner HTML",
        onClick: () => {
          if (frameRef.current) {
            const html =
              menuSelectedItems.length > 1
                ? menuSelectedItems
                    .map(
                      (item) =>
                        frameRef.current?.getElementInnerHtml(item.path) || "",
                    )
                    .join("\n")
                : frameRef.current.getElementInnerHtml(path);
            void copyToClipboard(html);
            toast("Copied inner HTML to clipboard", "success");
          }
        },
      },
      { divider: true },
      {
        label:
          menuSelectedItems.length > 1
            ? "Save as Component (Grouped)..."
            : "Save as Component...",
        disabled: !activeDocument,
        onClick: () => {
          const defaultName =
            menuSelectedItems.length > 1
              ? "Grouped Component"
              : menuSelectedItems[0]?.label || "My Component";
          setDialogConfig({
            isOpen: true,
            title: "Save as Component",
            message:
              menuSelectedItems.length > 1
                ? `Enter a name for the grouped component template containing ${menuSelectedItems.length} elements:`
                : "Enter a name for the new component template:",
            type: "prompt",
            promptPlaceholder: defaultName,
            confirmText: "Save",
            cancelText: "Cancel",
            onConfirm: async (name) => {
              const finalName = name?.trim() || defaultName;
              await runTask("Template saved.", async () => {
                const html =
                  frameRef.current?.getSelectedHtml(inlineTemplateStyles) || "";
                if (!html.trim()) {
                  throw new Error("No selected HTML was available.");
                }
                await api.saveTemplate({
                  name: finalName,
                  html,
                  sourceDocumentId: activeDocument!.id,
                });
                const response = await api.listTemplates();
                setTemplates(response.templates);
                setSelectedTemplateId(response.templates[0]?.id || "");
                setRenameTemplateName(response.templates[0]?.name || "");
                return "Component saved.";
              });
            },
            onCancel: () => {},
          });
        },
      },
      { divider: true },
      {
        label:
          menuSelectedItems.length > 1 ? "Delete Elements" : "Delete Element",
        onClick: () => {
          if (isAlreadySelected) {
            handleElementEdit({ styles: { display: "none" } });
          } else {
            const fullEdit: ElementEdit = {
              styles: { display: "none" },
              targetPath: path,
            };
            frameRef.current?.applyElementEdit(fullEdit);
            setPendingEdits((prev) => ({
              ...prev,
              [path]: mergeEdits(prev[path], fullEdit),
            }));
          }
          toast(
            menuSelectedItems.length > 1
              ? "Elements deleted"
              : "Element deleted",
            "warning",
          );
        },
      },
    ];
    setContextMenu({ x, y, items });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLElement &&
      (e.target.classList.contains("canvas-column") ||
        e.target.classList.contains("canvas-breadcrumbs") ||
        e.target.classList.contains("empty-canvas") ||
        e.target.closest(".empty-canvas") ||
        e.target.closest(".canvas-breadcrumbs"))
    ) {
      e.preventDefault();
      handleFrameContextMenu(e.clientX, e.clientY, "__canvas__");
    }
  };

  const handleDocumentContextMenu = (
    e: React.MouseEvent,
    doc: DocumentSummary,
  ) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { label: "Open", onClick: () => openDocument(doc.id) },
      {
        label: "Open in New Tab",
        onClick: () => {
          setOpenDocIds((prev) =>
            prev.includes(doc.id) ? prev : [...prev, doc.id],
          );
          void openDocument(doc.id);
        },
      },
      { divider: true },
      {
        label: "Copy Path",
        onClick: () => {
          void copyToClipboard(doc.relativePath);
          toast("Path copied", "success");
        },
      },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const handleTabContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const items: ContextMenuItem[] = [
      {
        label: "Close",
        onClick: () => {
          closeTab(docId);
        },
      },
      {
        label: "Close Others",
        disabled: openDocIds.length <= 1,
        onClick: () => {
          setOpenDocIds([docId]);
          if (activeDocument?.id !== docId) {
            void openDocument(docId);
          }
        },
      },
      {
        label: "Close All",
        onClick: () => {
          setOpenDocIds([]);
          setActiveDocument(null);
        },
      },
      { divider: true },
      {
        label: "Copy Path",
        onClick: () => {
          void copyToClipboard(doc.relativePath);
          toast("Path copied", "success");
        },
      },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const handleSidebarContextMenu = (e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLElement &&
      (e.target.classList.contains("sidebar") ||
        e.target.classList.contains("sidebar-section-content") ||
        e.target.tagName.toLowerCase() === "aside")
    ) {
      e.preventDefault();
      const items: ContextMenuItem[] = [
        {
          label: "Refresh Documents",
          onClick: () => {
            void refreshDocuments();
            toast("Refreshed document list", "success");
          },
        },
        {
          label: "Preferences",
          onClick: () => setActiveView("settings"),
        },
        { divider: true },
        {
          label: "New Document",
          onClick: () => setIsNewDocModalOpen(true),
        },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    }
  };

  const handleTemplateContextMenu = (
    e: React.MouseEvent,
    template: TemplateRecord,
  ) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      {
        label: "Insert Into Active Document",
        disabled: !activeDocument,
        onClick: () => {
          setSelectedTemplateId(template.id);
          setTimeout(() => {
            void insertTemplate();
          }, 50);
        },
      },
      { divider: true },
      {
        label: "Delete Snippet",
        onClick: () => {
          setSelectedTemplateId(template.id);
          setTimeout(() => {
            void deleteTemplate();
          }, 50);
        },
      },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return documents;
    }
    return documents.filter((document) =>
      document.relativePath.toLowerCase().includes(query),
    );
  }, [documents, search]);

  const filteredTemplates = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) => {
      return (
        template.name.toLowerCase().includes(query) ||
        template.previewText.toLowerCase().includes(query) ||
        template.sourceDocumentPath?.toLowerCase().includes(query)
      );
    });
  }, [templates, librarySearch]);

  const pendingCount = Object.keys(pendingEdits).length;
  const hasUnsavedChanges = pendingCount > 0 || settingsDirty || pendingGlobalStyle !== null;
  const activeTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );

  // Show/hide selection info panel dynamically based on selections
  useEffect(() => {
    if (!dockviewApi) return;
    const panel = dockviewApi.getPanel("infoPanel");
    if (selectedItems.length > 0) {
      if (!panel) {
        dockviewApi.addPanel({
          id: "infoPanel",
          component: "infoPanel",
          title: "Selection References",
          floating: {
            x: 300,
            y: window.innerHeight - 250,
            width: 320,
            height: 180,
          },
        });
      } else {
        (panel.api as any).setVisible(true);
      }
    } else {
      if (panel) {
        (panel.api as any).setVisible(false);
      }
    }
  }, [selectedItems, dockviewApi]);

  async function runTask(
    successMessage: string,
    task: () => Promise<string | void>,
  ) {
    setBusy(true);
    try {
      const detailedMessage = await task();
      setStatus(detailedMessage || successMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(id: string, options: { force?: boolean } = {}) {
    if (hasUnsavedChanges && !options.force) {
      setStatus("Save or discard changes before switching documents.");
      return;
    }
    await runTask("Document opened.", async () => {
      const detail = await api.getDocument(id);
      setActiveDocument(detail);
      setOpenDocIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setSettings(detail.settings);
      setSettingsDirty(false);
      setPendingEdits({});
      setGlobalStyle(detail.globalStyle || "");
      setPendingGlobalStyle(null);
      
      const initialSnapshot: HistorySnapshot = {
        pendingEdits: {},
        settings: detail.settings,
        settingsDirty: false,
        pendingGlobalStyle: null,
      };
      setPast([initialSnapshot]);
      setFuture([]);
      
      setSelectedItems([]);
      setAncestors([]);
      setReloadToken((value) => value + 1);
      setActiveView("editor");
      setCurrentSlideIndex(0);
      setSlideScale(1.0);
      setDiscoveredSlides([]);
      return `Opened ${detail.relativePath}`;
    });
  }

  async function refreshDocuments() {
    try {
      const response = await api.listDocuments();
      setDocuments(response.documents);
      if (!activeDocument && response.documents[0]) {
        await openDocument(response.documents[0].id);
      }
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to refresh documents",
        "error",
      );
    }
  }

  async function bootstrap() {
    await runTask("Ready.", async () => {
      await api.getWorkspace();
      const [documentResponse, templateResponse] = await Promise.all([
        api.listDocuments(),
        api.listTemplates(),
      ]);
      setDocuments(documentResponse.documents);
      setTemplates(templateResponse.templates);
      if (documentResponse.documents[0]) {
        await openDocument(documentResponse.documents[0].id);
      }
      setActiveView("editor");
    });
  }

  async function handleCreateNewDocument(
    name: string,
    settings: DocumentSettings,
  ) {
    const fileName =
      name.endsWith(".html") || name.endsWith(".htm") ? name : `${name}.html`;
    const response = await api.createDocument({ name: fileName, settings });
    if (response.ok && response.document) {
      await refreshDocuments();
      await openDocument(response.document.id);
      triggerConfetti();
    } else {
      throw new Error("Failed to create new document");
    }
  }

  useEffect(() => {
    void bootstrap();
    // The initial load should run once; subsequent state changes are driven by explicit user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateToken(value: string) {
    setTokenInput(value);
    setStoredToken(value);
  }

  function handleSettingsChange(nextSettings: DocumentSettings) {
    setSettings(nextSettings);
    setSettingsDirty(true);
    frameRef.current?.applyDocumentSettings(nextSettings);
    pushToHistory(pendingEdits, nextSettings, true, pendingGlobalStyle, true);
  }

  const handleGlobalStyleChange = (css: string) => {
    setPendingGlobalStyle(css);
    if (frameRef.current) {
      frameRef.current.applyGlobalStyle(css);
    }
    pushToHistory(pendingEdits, settings, settingsDirty, css, false);
  };

  function handleElementEdit(edit: Omit<ElementEdit, "targetPath">) {
    if (!selectedItems.length) {
      return;
    }

    const nextPending = { ...pendingEdits };
    for (const item of selectedItems) {
      const fullEdit: ElementEdit = { ...edit, targetPath: item.path, selector: item.selector };
      frameRef.current?.applyElementEdit(fullEdit);
      nextPending[item.path] = mergeEdits(nextPending[item.path], fullEdit);
    }
    setPendingEdits(nextPending);

    const isText = typeof edit.textContent === "string";
    pushToHistory(nextPending, settings, settingsDirty, pendingGlobalStyle, !isText);
  }

  function discardLocalChanges() {
    if (!activeDocument) {
      return;
    }
    setPendingEdits({});
    setSettingsDirty(false);
    setPendingGlobalStyle(null);
    setSelectedItems([]);
    setReloadToken((value) => value + 1);
    
    if (past.length > 0) {
      setPast([past[0]]);
    } else {
      setPast([]);
    }
    setFuture([]);
    
    setStatus("Discarded local changes.");
  }

  async function saveChanges() {
    if (!activeDocument) {
      return;
    }
    await runTask("Saved changes.", async () => {
      await api.saveEdits(activeDocument.id, {
        elementEdits: Object.values(pendingEdits),
        documentSettings: settingsDirty ? settings : undefined,
        globalStyle: pendingGlobalStyle !== null ? pendingGlobalStyle : undefined,
      });
      setPendingEdits({});
      setSettingsDirty(false);
      const finalStyle = pendingGlobalStyle !== null ? pendingGlobalStyle : globalStyle;
      setGlobalStyle(finalStyle);
      setPendingGlobalStyle(null);
      
      const cleanSnapshot: HistorySnapshot = {
        pendingEdits: {},
        settings: settings,
        settingsDirty: false,
        pendingGlobalStyle: null,
      };
      setPast([cleanSnapshot]);
      setFuture([]);
      
      await openDocument(activeDocument.id, { force: true });
      await refreshDocuments();
      triggerConfetti();
      // #32 — Save button success flash
      setSaveBtnFlash(true);
      setTimeout(() => setSaveBtnFlash(false), 1600);
    });
  }

  async function exportHtml() {
    if (!activeDocument) {
      return;
    }
    await runTask("HTML export created.", async () => {
      const result = await api.exportHtml(activeDocument.id);
      triggerConfetti();
      const filename = result.path.split(/[/\\]/).pop() || "export.html";
      const link = document.createElement("a");
      link.href = `/api/exports/download?filename=${encodeURIComponent(filename)}`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return `HTML export: ${result.path}`;
    });
  }

  async function exportPdf() {
    if (!activeDocument) {
      return;
    }
    await runTask("PDF export created.", async () => {
      const result = await api.exportPdf(activeDocument.id);
      triggerConfetti();
      const filename = result.path.split(/[/\\]/).pop() || "export.pdf";
      const link = document.createElement("a");
      link.href = `/api/exports/download?filename=${encodeURIComponent(filename)}`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return `PDF export: ${result.path}`;
    });
  }

  async function saveTemplate() {
    if (!activeDocument || !selectedItems.length) {
      return;
    }
    await runTask("Template saved.", async () => {
      const html =
        frameRef.current?.getSelectedHtml(inlineTemplateStyles) || "";
      if (!html.trim()) {
        throw new Error("No selected HTML was available.");
      }
      await api.saveTemplate({
        name:
          templateName ||
          (selectedItems.length > 1
            ? `Grouped Component (${selectedItems.length} items)`
            : selectedItems[0].label),
        html,
        sourceDocumentId: activeDocument.id,
      });
      setTemplateName("");
      const response = await api.listTemplates();
      setTemplates(response.templates);
      setSelectedTemplateId(response.templates[0]?.id || "");
      setRenameTemplateName(response.templates[0]?.name || "");
      return "Component saved.";
    });
  }

  async function insertTemplate() {
    if (!activeDocument || !selectedTemplateId || !selectedItems[0]) {
      return;
    }
    await runTask("Template inserted.", async () => {
      await api.insertTemplate(activeDocument.id, {
        templateId: selectedTemplateId,
        targetPath: selectedItems[0].path,
        placement: templatePlacement,
      });
      setSelectedItems([]);
      await openDocument(activeDocument.id, { force: true });
      return "Component inserted.";
    });
  }

  async function renameTemplate() {
    if (!selectedTemplateId || !renameTemplateName.trim()) {
      return;
    }
    await runTask("Component renamed.", async () => {
      const response = await api.updateTemplate(selectedTemplateId, {
        name: renameTemplateName,
      });
      const templateResponse = await api.listTemplates();
      setTemplates(templateResponse.templates);
      setSelectedTemplateId(response.template.id);
      setRenameTemplateName(response.template.name);
      return "Component renamed.";
    });
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) {
      return;
    }
    const template = templates.find((t) => t.id === selectedTemplateId);
    setDialogConfig({
      isOpen: true,
      title: "Delete Component",
      message: `Are you sure you want to delete the component "${template?.name || "this component"}"? This action cannot be undone.`,
      type: "confirm",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        await runTask("Component deleted.", async () => {
          await api.deleteTemplate(selectedTemplateId);
          const response = await api.listTemplates();
          setTemplates(response.templates);
          setSelectedTemplateId(response.templates[0]?.id || "");
          setRenameTemplateName(response.templates[0]?.name || "");
          return "Component deleted.";
        });
      },
      onCancel: () => {},
    });
  }

  function handleTemplateSelection(id: string) {
    setSelectedTemplateId(id);
    setRenameTemplateName(
      templates.find((template) => template.id === id)?.name || "",
    );
  }

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.hasAttribute("contenteditable") ||
        (activeEl as HTMLElement).isContentEditable
      );

      if (slideDeckMode && discoveredSlides.length > 0 && !isInput) {
        if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
          e.preventDefault();
          setCurrentSlideIndex((prev) => Math.min(discoveredSlides.length - 1, prev + 1));
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
          e.preventDefault();
          setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
          return;
        }
      }

      if (isMeta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsNewDocModalOpen(true);
      }

      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }

      if (isMeta && e.key === ".") {
        e.preventDefault();
        setZenMode((prev) => !prev);
      }

      if (isMeta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) {
          void saveChanges();
        }
      }

      if (isMeta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (activeDocument) {
          void exportHtml();
        }
      }

      if (isMeta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (activeDocument) {
          void exportPdf();
        }
      }

      if (isMeta && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        togglePanelVisible("sidebar");
      }

      if (isMeta && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        togglePanelVisible("inspector");
      }

      if (isMeta && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        togglePanelVisible("infoPanel");
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasUnsavedChanges,
    activeDocument,
    settings,
    pendingEdits,
    settingsDirty,
    sidebarVisible,
    inspectorVisible,
    infoPanelVisible,
    slideDeckMode,
    discoveredSlides,
    togglePanelVisible,
  ]);

  const allCommands = (() => {
    const list = [
      {
        label: "Save Changes",
        category: "File",
        shortcut: "⌘S",
        action: () => {
          if (hasUnsavedChanges) void saveChanges();
        },
      },
      {
        label: "Discard Local Changes",
        category: "File",
        action: () => {
          if (hasUnsavedChanges) discardLocalChanges();
        },
      },
      {
        label: "Preferences",
        category: "Navigation",
        shortcut: "⌘,",
        action: () => setActiveView("settings"),
      },
      {
        label: "Switch to Document Editor",
        category: "Navigation",
        action: () => setActiveView("editor"),
      },
      {
        label: "Switch to Component Library",
        category: "Navigation",
        action: () => setActiveView("library"),
      },
      {
        label: "Toggle Navigator (Sidebar)",
        category: "View",
        shortcut: "⌘⇧L",
        action: () => togglePanelVisible("sidebar"),
      },
      {
        label: "Toggle Inspector",
        category: "View",
        shortcut: "⌘⇧R",
        action: () => togglePanelVisible("inspector"),
      },
      {
        label: "Toggle Selection Info Panel",
        category: "View",
        shortcut: "⌘⇧I",
        action: () => togglePanelVisible("infoPanel"),
      },
      {
        label: "Toggle Zen Mode",
        category: "View",
        shortcut: "⌘.",
        action: () => setZenMode((z) => !z),
      },
      {
        label: "Toggle Slide Deck View",
        category: "Presentation",
        action: () => {
          setSettings((prev) => {
            const nextPreset: "A4" | "Letter" | "Legal" | "Slide16_9" | "Custom" = prev.pageSizePreset === "Slide16_9" ? "A4" : "Slide16_9";
            const orient = prev.orientation;
            const next = { ...prev, pageSizePreset: nextPreset };
            if (nextPreset === "Slide16_9") {
              next.width = "297mm";
              next.height = "167mm";
            } else {
              next.width = orient === "landscape" ? "297mm" : "210mm";
              next.height = orient === "landscape" ? "210mm" : "297mm";
            }
            setSettingsDirty(true);
            return next;
          });
        },
      },
      {
        label: "Next Slide",
        category: "Presentation",
        shortcut: "→ / Space",
        action: () => {
          setCurrentSlideIndex((prev) => Math.min(discoveredSlides.length - 1, prev + 1));
        },
      },
      {
        label: "Previous Slide",
        category: "Presentation",
        shortcut: "← / Shift+Space",
        action: () => {
          setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
        },
      },
      {
        label: "Export Document to HTML",
        category: "Export",
        shortcut: "⌘E",
        action: () => {
          if (activeDocument) void exportHtml();
        },
      },
      {
        label: "Export Document to PDF",
        category: "Export",
        shortcut: "⌘P",
        action: () => {
          if (activeDocument) void exportPdf();
        },
      },
      {
        label: "Use Light Theme",
        category: "Preferences",
        action: () => setTheme("light"),
      },
      {
        label: "Use Dark Theme",
        category: "Preferences",
        action: () => setTheme("dark"),
      },
      {
        label: "Use OLED True Black Theme",
        category: "Preferences",
        action: () => setTheme("true-black"),
      },
      {
        label: "Use System Default Theme",
        category: "Preferences",
        action: () => setTheme("system"),
      },
      {
        label: "Use Accent Accent: Blue",
        category: "Preferences",
        action: () => setAccent("blue"),
      },
      {
        label: "Use Accent Accent: Purple",
        category: "Preferences",
        action: () => setAccent("purple"),
      },
      {
        label: "Use Accent Accent: Teal",
        category: "Preferences",
        action: () => setAccent("teal"),
      },
      {
        label: "Use Accent Accent: Orange",
        category: "Preferences",
        action: () => setAccent("orange"),
      },
      {
        label: "Use Accent Accent: Rose",
        category: "Preferences",
        action: () => setAccent("rose"),
      },
    ];

    documents.forEach((doc) => {
      list.push({
        label: `Open Document: ${doc.name}`,
        category: "Documents",
        shortcut: "",
        action: () => {
          void openDocument(doc.id);
        },
      });
    });

    templates.forEach((tmpl) => {
      list.push({
        label: `Insert Component: ${tmpl.name}`,
        category: "Components",
        shortcut: "",
        action: () => {
          setSelectedTemplateId(tmpl.id);
          setTimeout(() => {
            void insertTemplate();
          }, 50);
        },
      });
    });

    return list;
  })();

  const filteredCommands = (() => {
    const query = commandSearch.trim().toLowerCase();
    if (!query) {
      return allCommands.slice(0, 10);
    }
    return allCommands.filter((cmd) => {
      return (
        cmd.label.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query)
      );
    });
  })();

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPaletteIndex((prev) =>
        Math.min(filteredCommands.length - 1, prev + 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPaletteIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredCommands[paletteIndex];
      if (selected) {
        selected.action();
        setShowCommandPalette(false);
        setCommandSearch("");
      }
    } else if (e.key === "Escape") {
      setShowCommandPalette(false);
      setCommandSearch("");
    }
  };

  function renderLibraryScreen() {
    return (
      <LibraryScreen
        filteredTemplates={filteredTemplates}
        selectedTemplateId={selectedTemplateId}
        activeTemplate={activeTemplate}
        librarySearch={librarySearch}
        renameTemplateName={renameTemplateName}
        onLibrarySearchChange={setLibrarySearch}
        onTemplateSelect={handleTemplateSelection}
        onTemplateContextMenu={handleTemplateContextMenu}
        onRenameTemplateNameChange={setRenameTemplateName}
        onRenameTemplate={() => void renameTemplate()}
        onDeleteTemplate={() => void deleteTemplate()}
        onReturnToEditor={() => setActiveView("editor")}
      />
    );
  }

  function renderSettingsScreen() {
    return (
      <SettingsScreen
        tokenInput={tokenInput}
        onTokenChange={updateToken}
        accent={accent}
        theme={theme}
        onAccentChange={setAccent}
        onThemeChange={setTheme}
        documentCount={documents.length}
        templateCount={templates.length}
        onReturnToEditor={() => setActiveView("editor")}
      />
    );
  }

  const cascadeFloatingPanels = () => {
    if (!dockviewApi) return;
    const panelsToFloat = [
      { id: "sidebar", component: "sidebar", title: "Navigator", defaultW: 240, defaultH: 500 },
      { id: "inspector", component: "inspector", title: "Inspector", defaultW: 280, defaultH: 500 },
      ...(selectedItems.length > 0 ? [{ id: "infoPanel", component: "infoPanel", title: "Selection References", defaultW: 320, defaultH: 180 }] : [])
    ];
    panelsToFloat.forEach((p, idx) => {
      const existing = dockviewApi.getPanel(p.id);
      if (existing) {
        existing.api.close();
      }
      dockviewApi.addPanel({
        id: p.id,
        component: p.component,
        title: p.title,
        floating: {
          x: 60 + idx * 40,
          y: 80 + idx * 40,
          width: p.defaultW,
          height: p.defaultH,
        },
      });
    });
    toast("Windows cascaded", "success");
  };

  const tileFloatingPanels = () => {
    if (!dockviewApi) return;
    const panelsToFloat = [
      { id: "sidebar", component: "sidebar", title: "Navigator" },
      { id: "inspector", component: "inspector", title: "Inspector" },
      ...(selectedItems.length > 0 ? [{ id: "infoPanel", component: "infoPanel", title: "Selection References" }] : [])
    ];
    const N = panelsToFloat.length;
    const padding = 6;
    const topOffset = 36;
    const bottomOffset = 16;
    const w = (window.innerWidth - padding * (N + 1)) / N;
    const h = window.innerHeight - topOffset - bottomOffset - padding * 2;
    panelsToFloat.forEach((p, idx) => {
      const existing = dockviewApi.getPanel(p.id);
      if (existing) {
        existing.api.close();
      }
      dockviewApi.addPanel({
        id: p.id,
        component: p.component,
        title: p.title,
        floating: {
          x: padding + idx * (w + padding),
          y: topOffset + padding,
          width: w,
          height: h,
        },
      });
    });
    toast("Windows tiled", "success");
  };

  const dockAllPanels = () => {
    if (!dockviewApi) return;
    const sidebar = dockviewApi.getPanel("sidebar");
    const inspector = dockviewApi.getPanel("inspector");
    const infoPanel = dockviewApi.getPanel("infoPanel");
    if (sidebar) sidebar.api.close();
    if (inspector) inspector.api.close();
    if (infoPanel) infoPanel.api.close();
    dockviewApi.addPanel({
      id: "sidebar",
      component: "sidebar",
      title: "Navigator",
      position: {
        referencePanel: "canvas",
        direction: "left",
      },
      initialWidth: 220,
      minimumWidth: 180,
    });
    dockviewApi.addPanel({
      id: "inspector",
      component: "inspector",
      title: "Inspector",
      position: {
        referencePanel: "canvas",
        direction: "right",
      },
      initialWidth: 280,
      minimumWidth: 240,
    });
    if (selectedItems.length > 0) {
      dockviewApi.addPanel({
        id: "infoPanel",
        component: "infoPanel",
        title: "Selection References",
        position: {
          referencePanel: "inspector",
          direction: "below",
        },
        initialHeight: 180,
        minimumHeight: 100,
      });
    }
    toast("All panels docked", "success");
  };

  const floatAllPanels = () => {
    if (!dockviewApi) return;
    const sidebar = dockviewApi.getPanel("sidebar");
    const inspector = dockviewApi.getPanel("inspector");
    const infoPanel = dockviewApi.getPanel("infoPanel");
    if (sidebar) sidebar.api.close();
    if (inspector) inspector.api.close();
    if (infoPanel) infoPanel.api.close();
    dockviewApi.addPanel({
      id: "sidebar",
      component: "sidebar",
      title: "Navigator",
      floating: {
        x: 50,
        y: 80,
        width: 240,
        height: 500,
      },
    });
    dockviewApi.addPanel({
      id: "inspector",
      component: "inspector",
      title: "Inspector",
      floating: {
        x: window.innerWidth - 300 - 6,
        y: 80,
        width: 280,
        height: 500,
      },
    });
    if (selectedItems.length > 0) {
      dockviewApi.addPanel({
        id: "infoPanel",
        component: "infoPanel",
        title: "Selection References",
        floating: {
          x: 350,
          y: 150,
          width: 320,
          height: 180,
        },
      });
    }
    toast("All panels floated", "success");
  };

  const resetWindowLayout = () => {
    if (!dockviewApi) return;
    setupDefaultLayout(dockviewApi);
    toast("Window layout reset", "success");
  };

  const menuBarRef = useRef<HTMLDivElement | null>(null);

  const handleMenuMouseDown = (
    menuName: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation(); // prevent ContextMenu's outside-mousedown from firing on this same event
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuCoords({ x: rect.left, y: rect.bottom });
    // Toggle: if already open, close it; otherwise open this one
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const handleMenuMouseEnter = (
    menuName: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (activeMenu !== null && activeMenu !== menuName) {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuCoords({ x: rect.left, y: rect.bottom });
      setActiveMenu(menuName);
    }
  };

  const menuBarData = [
    {
      name: "File",
      items: [
        {
          label: "New Document",
          onClick: () => setIsNewDocModalOpen(true),
          shortcut: "⌘N",
        },
        {
          label: "Preferences...",
          onClick: () => setActiveView("settings"),
          shortcut: "⌘,",
        },
        { divider: true },
        {
          label: "Save",
          disabled: !hasUnsavedChanges,
          onClick: saveChanges,
          shortcut: "⌘S",
        },
        {
          label: "Discard Changes",
          disabled: !hasUnsavedChanges,
          onClick: discardLocalChanges,
        },
      ],
    },
    {
      name: "Edit",
      items: [
        { label: "Undo", disabled: true, shortcut: "⌘Z" },
        { label: "Redo", disabled: true, shortcut: "⇧⌘Z" },
        { divider: true },
        {
          label: "Copy Agent Reference",
          disabled: selectedItems.length === 0,
          onClick: () => {
            if (selectedItems.length > 0) {
              void copyToClipboard(
                selectedItems.map((item) => item.agentReference).join("\n"),
              );
              toast("References copied to clipboard", "success");
            }
          },
          shortcut: "⌘C",
        },
      ],
    },
    {
      name: "View",
      items: [
        {
          label: "Navigator (Sidebar)",
          icon: sidebarVisible ? <Check size={10} /> : undefined,
          onClick: () => togglePanelVisible("sidebar"),
          shortcut: "⌘⇧L",
        },
        {
          label: "Inspector",
          icon: inspectorVisible ? <Check size={10} /> : undefined,
          onClick: () => togglePanelVisible("inspector"),
          shortcut: "⌘⇧R",
        },
        {
          label: "Selection Info Panel",
          icon: infoPanelVisible ? <Check size={10} /> : undefined,
          onClick: () => togglePanelVisible("infoPanel"),
          shortcut: "⌘⇧I",
        },
        { divider: true },
        {
          label: "Toggle Zen Mode",
          icon: zenMode ? <Check size={10} /> : undefined,
          onClick: () => setZenMode(!zenMode),
          shortcut: "⌘.",
        },
      ],
    },
    {
      name: "Window",
      items: [
        { label: "Cascade Floating Windows", onClick: cascadeFloatingPanels },
        { label: "Tile Floating Windows", onClick: tileFloatingPanels },
        { divider: true },
        { label: "Dock All Panels", onClick: dockAllPanels },
        { label: "Float All Panels", onClick: floatAllPanels },
        { label: "Reset Window Layout", onClick: resetWindowLayout },
      ],
    },
    {
      name: "Export",
      items: [
        {
          label: "Export HTML...",
          disabled: !activeDocument,
          onClick: exportHtml,
          shortcut: "⌘E",
        },
        {
          label: "Export PDF...",
          disabled: !activeDocument,
          onClick: exportPdf,
          shortcut: "⌘P",
        },
      ],
    },
    {
      name: "Help",
      items: [
        { label: "Agent Guide", disabled: true },
        { label: "About Document Viewer", disabled: true },
      ],
    },
  ];

  const contextValue = {
    canvasRef,
    frameRef,
    openDocIds,
    activeDocument,
    documents,
    hasUnsavedChanges,
    ancestors,
    slideDeckMode,
    discoveredSlides,
    currentSlideIndex,
    slideScale,
    docScale,
    activeInspectorTab,
    selectedItems,
    settings,
    settingsDirty,
    pendingCount,
    pendingEdits,
    templates,
    templateName,
    inlineTemplateStyles,
    selectedTemplateId,
    templatePlacement,
    librarySearch,
    renameTemplateName,
    globalStyle,
    pendingGlobalStyle,
    fipCopyNotice,
    destinationsExpanded,
    documentsExpanded,
    search,
    filteredDocuments,
    reloadToken,
    selectorEnabled,
    activeView,
    busy,
    setSlideScale,
    setDiscoveredSlides,
    setCurrentSlideIndex,
    setDestinationsExpanded,
    setDocumentsExpanded,
    setSearch,
    setActiveView,
    setIsNewDocModalOpen,
    setActiveInspectorTab,
    setTemplateName,
    setInlineTemplateStyles,
    setTemplatePlacement,
    setLibrarySearch,
    setRenameTemplateName,
    setFipCopyNotice,
    openDocument,
    closeDocumentTab,
    handleTabContextMenu,
    handleCanvasContextMenu,
    handleSelectionChange,
    handleFrameContextMenu,
    handleElementEdit,
    fitToWorkspaceRef,
    handleSidebarContextMenu,
    handleDocumentContextMenu,
    refreshDocuments,
    handleSettingsChange,
    handleTemplateSelection,
    saveTemplate,
    insertTemplate,
    renameTemplate,
    deleteTemplate,
    handleTemplateContextMenu,
    handleGlobalStyleChange,
    dockviewApi,
    togglePanelVisible
  };

  return (
    <main
      ref={shellRef}
      className={`app-shell ${zenMode ? "zen-mode" : ""} ${topbarMaximized ? "topbar-maximized" : ""} ${
        activeView === "editor" && openDocIds.length > 0 ? "has-tab-bar" : ""
      }`}
      style={
        {
          "--sidebar-width": `${leftDockWidth}px`,
          "--inspector-width": `${rightDockWidth}px`,
          "--topbar-left-width": `${Math.max(200, leftDockWidth)}px`,
        } as React.CSSProperties
      }
    >
      {/* ── macOS WINDOW HEADER / TITLEBAR ──────────────────── */}
      <header
        className="topbar"
        onDoubleClick={() => setTopbarMaximized((prev) => !prev)}
      >
        {/* Native menu bar (Item 13) */}
        <div className="menu-bar" ref={menuBarRef}>
          {menuBarData.map((menu) => {
            const isOpen = activeMenu === menu.name;
            return (
              <div key={menu.name} style={{ position: "relative" }}>
                <button
                  type="button"
                  className={`menu-bar-btn ${isOpen ? "menu-bar-btn--active" : ""}`}
                  onMouseDown={(e) => handleMenuMouseDown(menu.name, e)}
                  onMouseEnter={(e) => handleMenuMouseEnter(menu.name, e)}
                >
                  {menu.name}
                </button>
                {isOpen && (
                  <ContextMenu
                    x={menuCoords.x}
                    y={menuCoords.y}
                    items={menu.items}
                    onClose={() => setActiveMenu(null)}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="document-identity">
          <div className="document-identity-wrapper">
            <span
              className={`document-dirty-dot ${hasUnsavedChanges ? "document-dirty-dot--active" : ""}`}
              title="Unsaved changes"
            />
            <strong>{activeDocument?.name || "No document selected"}</strong>
          </div>
          <span>
            {activeDocument?.relativePath || "Select a document below"}
            {activeDocument &&
              ` · ${settings.pageSizePreset} ${settings.orientation.toUpperCase()}`}
          </span>
        </div>

        <div className="toolbar-actions">
          <div className="segmented-control">
            <button
              type="button"
              className={`segment-btn ${selectorEnabled ? "segment-btn--active" : ""}`}
              title="Select mode (Precision Selector)"
              onClick={() => {
                setSelectorEnabled(true);
                setActiveInspectorTab("selection");
                if (dockviewApi && !dockviewApi.getPanel("inspector")) {
                  togglePanelVisible("inspector");
                }
              }}
            >
              <MousePointer2 size={12} />
            </button>
            <button
              type="button"
              className={`segment-btn ${!selectorEnabled ? "segment-btn--active" : ""}`}
              title="Preview mode"
              onClick={() => {
                setSelectorEnabled(false);
                setActiveInspectorTab("document");
              }}
            >
              <Eye size={12} />
            </button>
          </div>



          <div className="toolbar-divider" />

          <div className="segmented-control">
            <button
              type="button"
              className={`segment-btn segment-btn--primary ${hasUnsavedChanges ? "dirty" : ""} ${saveBtnFlash ? "save-success" : ""}`}
              disabled={busy || !hasUnsavedChanges}
              onClick={saveChanges}
              title="Save changes (Cmd+S)"
              aria-label="Save"
            >
              {saveBtnFlash ? <Check size={12} /> : <Save size={12} />}
            </button>
            <button
              type="button"
              className="segment-btn"
              disabled={busy || !hasUnsavedChanges}
              onClick={discardLocalChanges}
              title="Discard changes"
            >
              <RotateCcw size={11} />
            </button>
            <div className="toolbar-divider" style={{ height: "12px", margin: "0 2px", alignSelf: "center", background: "rgba(255,255,255,0.08)", width: "1px" }} />
            <button
              type="button"
              className="segment-btn"
              disabled={busy || !canUndo}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              <Undo size={11} />
            </button>
            <button
              type="button"
              className="segment-btn"
              disabled={busy || !canRedo}
              onClick={redo}
              title="Redo (Ctrl+Y)"
            >
              <Redo size={11} />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="segmented-control">
            <button
              type="button"
              className="segment-btn"
              disabled={busy || !activeDocument}
              onClick={exportHtml}
              title="Export HTML"
            >
              <Globe2 size={12} />
            </button>
            <button
              type="button"
              className="segment-btn"
              disabled={busy || !activeDocument}
              onClick={exportPdf}
              title="Export PDF"
            >
              <Download size={12} />
            </button>
          </div>

          <div className="toolbar-divider" />

          <IconButton
            title="Refresh documents"
            disabled={busy}
            onClick={() => void refreshDocuments()}
          >
            <RefreshCw size={12} />
          </IconButton>

          <IconButton
            title="Component Library"
            active={activeView === "library"}
            onClick={() =>
              setActiveView(activeView === "library" ? "editor" : "library")
            }
          >
            <Library size={12} />
          </IconButton>
        </div>
      </header>

      {/* ── WORKSPACE GRID ──────────────────────────────────── */}
      <div className="workspace-grid grid--dockview">
        {activeView === "editor" ? (
          <AppContext.Provider value={contextValue}>
            <DockviewReact
              components={components}
              onReady={onReady}
              className="dockview-theme-dark hdv-dockview"
            />
          </AppContext.Provider>
        ) : activeView === "library" ? (
          renderLibraryScreen()
        ) : (
          renderSettingsScreen()
        )}
      </div>

      {/* Frosted Status Bar Footer */}
      <footer
        className={`footer-status-bar ${!footerVisible ? "footer-status-bar--hidden" : ""}`}
        onMouseEnter={() => setFooterVisible(true)}
      >
        <div className="footer-status-left">
          <span className="footer-status-message">{status}</span>
        </div>
        <div className="footer-status-right">
          {activeDocument && (
            <span>
              {settings.pageSizePreset} · {settings.orientation.toUpperCase()}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="footer-pending-badge">{pendingCount} pending</span>
          )}
        </div>
      </footer>

      {/* Toast container (Item 40) */}
      <ToastContainer />

      {/* Global context menu (Item 82) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Dynamic Dialog Overlay (Item 84) */}
      {dialogConfig && (
        <Dialog
          isOpen={dialogConfig.isOpen}
          title={dialogConfig.title}
          message={dialogConfig.message}
          type={dialogConfig.type}
          promptPlaceholder={dialogConfig.promptPlaceholder}
          confirmText={dialogConfig.confirmText}
          cancelText={dialogConfig.cancelText}
          onConfirm={(val) => {
            dialogConfig.onConfirm(val);
            setDialogConfig(null);
          }}
          onCancel={() => {
            dialogConfig.onCancel();
            setDialogConfig(null);
          }}
        />
      )}

      {/* Command Palette Overlay (Item 22) */}
      {showCommandPalette && (
        <div
          className="palette-overlay"
          onClick={() => setShowCommandPalette(false)}
        >
          <div className="palette-window" onClick={(e) => e.stopPropagation()}>
            <div className="palette-search-wrapper">
              <Search size={16} className="palette-search-icon" />
              <input
                type="text"
                className="palette-search-input"
                placeholder="Type a command or search documents..."
                value={commandSearch}
                onChange={(e) => {
                  setCommandSearch(e.target.value);
                  setPaletteIndex(0);
                }}
                onKeyDown={handlePaletteKeyDown}
                autoFocus
              />
            </div>
            <div className="palette-results">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`palette-result-row ${idx === paletteIndex ? "palette-result-row--active" : ""}`}
                    onClick={() => {
                      cmd.action();
                      setShowCommandPalette(false);
                      setCommandSearch("");
                    }}
                  >
                    <div className="palette-result-left">
                      <span className="palette-result-category">
                        {cmd.category}
                      </span>
                      <span className="palette-result-label">{cmd.label}</span>
                    </div>
                    {cmd.shortcut && (
                      <span className="palette-result-shortcut">
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="palette-empty">No commands found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zen Mode Exit Pill (Item 97) */}
      {zenMode && (
        <div className="zen-exit-pill-container">
          <button
            type="button"
            className="zen-exit-pill"
            onClick={() => setZenMode(false)}
          >
            Exit Zen Mode <kbd style={{ marginLeft: 6 }}>⌘.</kbd>
          </button>
        </div>
      )}

      {/* Startup Cinema Sequence (Item 100) */}
      {startupActive && (
        <div className="startup-cinema">
          <div className="startup-logo-wrapper">
            <FileText size={80} strokeWidth={1} className="startup-logo-icon" />
          </div>
        </div>
      )}

      {isNewDocModalOpen && (
        <NewDocumentModal
          isOpen={isNewDocModalOpen}
          onCancel={() => setIsNewDocModalOpen(false)}
          onCreate={handleCreateNewDocument}
        />
      )}
    </main>
  );
}

const DockviewCanvas = () => {
  const ctx = useContext(AppContext);
  if (!ctx) return null;
  const {
    canvasRef,
    handleCanvasContextMenu,
    openDocIds,
    documents,
    activeDocument,
    openDocument,
    handleTabContextMenu,
    hasUnsavedChanges,
    closeDocumentTab,
    ancestors,
    frameRef,
    slideDeckMode,
    handleSelectionChange,
    discoveredSlides,
    settings,
    currentSlideIndex,
    setCurrentSlideIndex,
    slideScale,
    setSlideScale,
    fitToWorkspaceRef,
    reloadToken,
    selectorEnabled,
    selectedItems,
    handleFrameContextMenu,
    handleElementEdit,
    pendingEdits,
    globalStyle,
    pendingGlobalStyle,
    docScale,
    setDiscoveredSlides
  } = ctx;

  return (
    <section
      className="canvas-column"
      ref={canvasRef}
      onContextMenu={handleCanvasContextMenu}
      style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      {/* Document Tab Bar (Item 24) */}
      {openDocIds.length > 0 && (
        <div className="document-tab-bar">
          <div className="document-tab-bar-scroll">
            {openDocIds.map((docId: string) => {
              const doc = documents.find((d: any) => d.id === docId);
              if (!doc) return null;
              const isActive = activeDocument?.id === docId;

              return (
                <div
                  key={docId}
                  className={`document-tab ${isActive ? "document-tab--active" : ""}`}
                  onClick={() => void openDocument(docId)}
                  onContextMenu={(e) => handleTabContextMenu(e, docId)}
                >
                  <FileText size={11} className="document-tab__icon" />
                  <span className="document-tab__name">{doc.name}</span>
                  {hasUnsavedChanges && isActive && (
                    <span className="document-tab__dirty-dot" />
                  )}
                  <button
                    type="button"
                    className="document-tab__close-btn"
                    onClick={(e) => closeDocumentTab(docId, e)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Breadcrumbs (Item 23) */}
      <div className="canvas-breadcrumbs">
        <span className="breadcrumb-file">
          {activeDocument?.relativePath || "No document selected"}
        </span>
        {ancestors.length > 0 && (
          <span className="breadcrumb-divider">&gt;</span>
        )}
        {ancestors.map((ancestor: any, index: number) => {
          const isCurrent = index === ancestors.length - 1;
          return (
            <span
              key={`${ancestor.path}-${index}`}
              className="breadcrumb-item-wrapper"
            >
              <button
                type="button"
                className={`breadcrumb-item ${isCurrent ? "breadcrumb-item--current" : ""}`}
                disabled={isCurrent}
                onClick={() => {
                  if (frameRef.current) {
                    frameRef.current.selectElementByPath(ancestor.path);
                  }
                }}
              >
                {formatBreadcrumb(ancestor.label)}
              </button>
              {index < ancestors.length - 1 && (
                <span className="breadcrumb-divider">&gt;</span>
              )}
            </span>
          );
        })}
      </div>

      {/* Canvas Content Wrapper (nested flex layout for bottom docking) */}
      {slideDeckMode ? (
        <div
          className="canvas-content-wrapper canvas-content-wrapper--slide-deck"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleSelectionChange([]);
            }
          }}
        >
          <div
            className="slide-deck-main-layout"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleSelectionChange([]);
              }
            }}
          >
            <div className="slide-deck-thumbnail-strip">
              {discoveredSlides.map((slide: any, idx: number) => {
                const resolved = resolvePageSize(settings);
                const wVal = cssLengthToPx(resolved.width);
                const hVal = cssLengthToPx(resolved.height);
                const aspectRatio = wVal > 0 && hVal > 0 ? `${wVal} / ${hVal}` : undefined;
                return (
                  <div
                    key={slide.id}
                    className={`slide-thumbnail-card ${currentSlideIndex === idx ? "slide-thumbnail-card--active" : ""}`}
                    onClick={() => setCurrentSlideIndex(idx)}
                    style={aspectRatio ? { aspectRatio } : undefined}
                  >
                    <span className="slide-thumbnail-number">{idx + 1}</span>
                    <div className="slide-thumbnail-card-inner">
                      <span className="slide-thumbnail-label">{slide.name}</span>
                    </div>
                  </div>
                );
              })}
              {discoveredSlides.length === 0 && (
                <div className="slide-thumbnail-empty">No slides detected</div>
              )}
            </div>

            <div
              className="slide-deck-frame-workspace"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  handleSelectionChange([]);
                }
              }}
            >
              <div
                className="slide-deck-frame-scale-container"
                style={(() => {
                  const resolved = resolvePageSize(settings);
                  return {
                    width: resolved.width,
                    height: resolved.height,
                    transform: `scale(${slideScale})`,
                    transformOrigin: "center center",
                  };
                })()}
              >
                <DocumentFrame
                  ref={frameRef}
                  documentId={activeDocument?.id}
                  documentPath={activeDocument?.relativePath}
                  reloadToken={reloadToken}
                  selectorEnabled={selectorEnabled}
                  selectedItems={selectedItems}
                  onSelectionChange={handleSelectionChange}
                  onFrameContextMenu={handleFrameContextMenu}
                  onElementEdit={handleElementEdit}
                  slideDeckMode={slideDeckMode}
                  currentSlideIndex={currentSlideIndex}
                  pendingEdits={pendingEdits}
                  settings={settings}
                  globalStyle={globalStyle}
                  pendingGlobalStyle={pendingGlobalStyle}
                  onSlidesDiscover={(slides) => {
                    setDiscoveredSlides((prev: any) => {
                      if (
                        prev.length === slides.length &&
                        prev.every((s: any, i: number) => s.id === slides[i].id && s.elementIndex === slides[i].elementIndex)
                      ) {
                        return prev;
                      }
                      return slides;
                    });
                  }}
                  shellClassName={
                    selectorEnabled
                      ? "document-frame-shell--select"
                      : "document-frame-shell--preview"
                  }
                />
              </div>
            </div>
          </div>

          <div className="slide-deck-navigation-bar">
            <div className="slide-deck-nav-left">
              <button
                type="button"
                className="slide-deck-nav-btn"
                disabled={currentSlideIndex <= 0}
                onClick={() => setCurrentSlideIndex((prev: number) => Math.max(0, prev - 1))}
                title="Previous slide"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="slide-deck-nav-indicator">
                Slide {discoveredSlides.length > 0 ? currentSlideIndex + 1 : 0} of {discoveredSlides.length}
              </span>
              <button
                type="button"
                className="slide-deck-nav-btn"
                disabled={currentSlideIndex >= discoveredSlides.length - 1}
                onClick={() => setCurrentSlideIndex((prev: number) => Math.min(discoveredSlides.length - 1, prev + 1))}
                title="Next slide"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="slide-deck-nav-center">
              {discoveredSlides.length > 0 && (
                <select
                  className="slide-deck-nav-select"
                  value={currentSlideIndex}
                  onChange={(e) => setCurrentSlideIndex(Number(e.target.value))}
                >
                  {discoveredSlides.map((slide: any, idx: number) => (
                    <option key={slide.id} value={idx}>
                      Slide {idx + 1}: {slide.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="slide-deck-nav-right">
              <div className="slide-deck-scale-controls">
                <span className="slide-deck-scale-label">Zoom: {Math.round(slideScale * 100)}%</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={slideScale}
                  onChange={(e) => setSlideScale(Number(e.target.value))}
                  className="slide-deck-scale-slider"
                />
                <button
                  type="button"
                  className="slide-deck-nav-btn"
                  onClick={() => fitToWorkspaceRef.current()}
                  title="Fit to workspace"
                  style={{ marginLeft: 6, fontSize: 10 }}
                >
                  Fit
                </button>
              </div>

              <div className="slide-deck-nav-divider" />

              <button
                type="button"
                className="slide-deck-nav-btn"
                onClick={() => {
                  const workspace = document.querySelector(".slide-deck-frame-workspace");
                  if (workspace) {
                    if (document.fullscreenElement) {
                      void document.exitFullscreen();
                    } else {
                      void workspace.requestFullscreen();
                    }
                  }
                }}
                title="Present slideshow"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="canvas-content-wrapper"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleSelectionChange([]);
            }
          }}
        >
          <DocumentFrame
            ref={frameRef}
            documentId={activeDocument?.id}
            documentPath={activeDocument?.relativePath}
            reloadToken={reloadToken}
            selectorEnabled={selectorEnabled}
            selectedItems={selectedItems}
            onSelectionChange={handleSelectionChange}
            onFrameContextMenu={handleFrameContextMenu}
            onElementEdit={handleElementEdit}
            slideDeckMode={slideDeckMode}
            currentSlideIndex={currentSlideIndex}
            pendingEdits={pendingEdits}
            settings={settings}
            globalStyle={globalStyle}
            pendingGlobalStyle={pendingGlobalStyle}
            docScale={docScale}
            onSlidesDiscover={(slides) => {
              setDiscoveredSlides((prev: any) => {
                if (
                  prev.length === slides.length &&
                  prev.every((s: any, i: number) => s.id === slides[i].id && s.elementIndex === slides[i].elementIndex)
                ) {
                  return prev;
                }
                return slides;
              });
            }}
            shellClassName={
              selectorEnabled
                ? "document-frame-shell--select"
                : "document-frame-shell--preview"
            }
          />
        </div>
      )}
    </section>
  );
};

const DockviewSidebar = () => {
  const ctx = useContext(AppContext);
  if (!ctx) return null;
  const {
    handleSidebarContextMenu,
    destinationsExpanded,
    setDestinationsExpanded,
    activeView,
    setActiveView,
    documentsExpanded,
    setDocumentsExpanded,
    documents,
    search,
    setSearch,
    filteredDocuments,
    openDocument,
    handleDocumentContextMenu,
    refreshDocuments,
    setIsNewDocModalOpen,
    activeDocument
  } = ctx;

  return (
    <div
      className="dockview-panel-container sidebar"
      onContextMenu={handleSidebarContextMenu}
    >
      {/* macOS Sidebar Navigation Categories */}
      <section
        className={`sidebar-section sidebar-nav-section ${!destinationsExpanded ? "collapsed" : ""}`}
        style={{ paddingBottom: destinationsExpanded ? 8 : 6 }}
      >
        <div
          className="section-title section-title-clickable"
          onClick={() => {
            const next = !destinationsExpanded;
            setDestinationsExpanded(next);
            localStorage.setItem("hdv-acc-destinations", String(next));
          }}
        >
          <div className="section-title-left">
            {destinationsExpanded ? (
              <ChevronDown size={10} />
            ) : (
              <ChevronRight size={10} />
            )}
            <span>Views</span>
          </div>
        </div>
        <div
          className={`sidebar-section-content ${destinationsExpanded ? "expanded" : "collapsed"}`}
        >
          <div>
            <div
              className="nav-list"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginTop: 6,
              }}
            >
              <button
                type="button"
                className={`nav-row ${activeView === "editor" ? "nav-row--active" : ""}`}
                onClick={() => setActiveView("editor")}
              >
                <FileText size={12} />
                <span>Document Editor</span>
              </button>
              <button
                type="button"
                className={`nav-row ${activeView === "library" ? "nav-row--active" : ""}`}
                onClick={() => setActiveView("library")}
              >
                <Library size={12} />
                <span>Component Library</span>
              </button>
              <button
                type="button"
                className={`nav-row ${activeView === "settings" ? "nav-row--active" : ""}`}
                onClick={() => setActiveView("settings")}
              >
                <Sliders size={12} />
                <span>Preferences</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Document list */}
      <section
        className={`sidebar-section sidebar-section--grow ${!documentsExpanded ? "collapsed" : ""}`}
        style={{
          paddingBottom: documentsExpanded ? 12 : 6,
          borderBottom: "none",
        }}
      >
        <div
          className="section-title section-title-clickable"
          onClick={() => {
            const next = !documentsExpanded;
            setDocumentsExpanded(next);
            localStorage.setItem("hdv-acc-documents", String(next));
          }}
        >
          <div className="section-title-left">
            {documentsExpanded ? (
              <ChevronDown size={10} />
            ) : (
              <ChevronRight size={10} />
            )}
            <span>Documents</span>
          </div>
          {documentsExpanded && <strong>{documents.length}</strong>}
        </div>
        <div
          className={`sidebar-section-content ${documentsExpanded ? "expanded" : "collapsed"}`}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              className="search-input-wrapper input-clearable"
              style={{ marginTop: 8 }}
            >
              <Search size={11} className="search-icon" />
              <input
                className="search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents…"
              />
              {search && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => setSearch("")}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <div className="document-list">
              {filteredDocuments.map((document: any) => (
                <button
                  type="button"
                  key={document.id}
                  className={
                    activeDocument?.id === document.id
                      ? "document-row document-row--active"
                      : "document-row"
                  }
                  onClick={() => void openDocument(document.id)}
                  onContextMenu={(e) =>
                    handleDocumentContextMenu(e, document)
                  }
                >
                  <div className="doc-row-content">
                    <FileText size={12} />
                    <div className="doc-info">
                      <span>{document.name}</span>
                      <small>{document.relativePath}</small>
                    </div>
                  </div>
                </button>
              ))}
              {!filteredDocuments.length && (
                <div className="empty-state" style={{ marginTop: 8 }}>
                  <strong>No documents found</strong>
                  <span>No HTML files match filter.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sidebar footer quick-actions (Item 26) */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-footer-btn"
          title="New Document"
          onClick={() => setIsNewDocModalOpen(true)}
        >
          <Plus size={12} />
        </button>
        <button
          type="button"
          className="sidebar-footer-btn"
          title="Refresh Documents"
          onClick={() => {
            void refreshDocuments();
            toast("Refreshed document list", "success");
          }}
        >
          <RefreshCw size={11} />
        </button>
      </div>
    </div>
  );
};

const DockviewInspector = () => {
  const ctx = useContext(AppContext);
  if (!ctx) return null;
  const {
    activeInspectorTab,
    selectedItems,
    settings,
    settingsDirty,
    pendingCount,
    pendingEdits,
    templates,
    templateName,
    inlineTemplateStyles,
    selectedTemplateId,
    templatePlacement,
    librarySearch,
    renameTemplateName,
    setActiveInspectorTab,
    handleSettingsChange,
    setTemplateName,
    setInlineTemplateStyles,
    handleTemplateSelection,
    setTemplatePlacement,
    setLibrarySearch,
    setRenameTemplateName,
    handleElementEdit,
    saveTemplate,
    insertTemplate,
    renameTemplate,
    deleteTemplate,
    handleTemplateContextMenu,
    ancestors,
    frameRef,
    activeDocument,
    globalStyle,
    pendingGlobalStyle,
    handleGlobalStyleChange
  } = ctx;

  return (
    <div className="dockview-panel-container inspector">
      <InspectorPanel
        activeTab={activeInspectorTab}
        selectedItems={selectedItems}
        settings={settings}
        settingsDirty={settingsDirty}
        pendingChangeCount={pendingCount}
        pendingEdits={pendingEdits}
        templates={templates}
        templateName={templateName}
        inlineTemplateStyles={inlineTemplateStyles}
        selectedTemplateId={selectedTemplateId}
        templatePlacement={templatePlacement}
        librarySearch={librarySearch}
        renameTemplateName={renameTemplateName}
        onTabChange={setActiveInspectorTab}
        onSettingsChange={handleSettingsChange}
        onTemplateNameChange={setTemplateName}
        onInlineTemplateStylesChange={setInlineTemplateStyles}
        onSelectedTemplateChange={handleTemplateSelection}
        onTemplatePlacementChange={setTemplatePlacement}
        onLibrarySearchChange={setLibrarySearch}
        onRenameTemplateNameChange={setRenameTemplateName}
        onElementEdit={handleElementEdit}
        onSaveTemplate={() => void saveTemplate()}
        onInsertTemplate={() => void insertTemplate()}
        onRenameTemplate={() => void renameTemplate()}
        onDeleteTemplate={() => void deleteTemplate()}
        onTemplateContextMenu={handleTemplateContextMenu}
        ancestors={ancestors}
        onSelectAncestor={(path) => {
          if (frameRef.current) {
            frameRef.current.selectElementByPath(path);
          }
        }}
        documentId={activeDocument?.id}
        globalStyle={globalStyle}
        pendingGlobalStyle={pendingGlobalStyle}
        onGlobalStyleChange={handleGlobalStyleChange}
      />
    </div>
  );
};

const DockviewInfoPanel = () => {
  const ctx = useContext(AppContext);
  if (!ctx) return null;
  const {
    selectedItems,
    fipCopyNotice,
    setFipCopyNotice
  } = ctx;

  const title = selectedItems.length === 1 ? selectedItems[0].label : `${selectedItems.length} components`;

  return (
    <div className="dockview-panel-container info-panel selection-popover">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--border-soft)", background: "rgba(255,255,255,0.02)" }}>
        <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-3)" }}>{title}</span>
        <button
          type="button"
          className="fip-action-btn"
          onClick={() => {
            void copyToClipboard(selectedItems.map((i: any) => i.agentReference).join("\n"))
              .then(() => {
                setFipCopyNotice("All references copied");
                setTimeout(() => setFipCopyNotice(""), 1800);
              });
          }}
          title="Copy all references"
          style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <Copy size={11} />
        </button>
      </div>

      <div className="fip-list" style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
        {selectedItems.map((item: any) => (
          <button
            key={item.path}
            type="button"
            className="fip-item"
            onClick={() => {
              void copyToClipboard(item.agentReference).then(() => {
                setFipCopyNotice("Copied");
                setTimeout(() => setFipCopyNotice(""), 1800);
              });
            }}
            title={item.agentReference}
            style={{ width: "100%", textAlign: "left", marginBottom: "4px" }}
          >
            <div className="fip-item-top" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="fip-item-tag">{item.tag}</span>
              <strong className="fip-item-label">{item.label}</strong>
            </div>
            <code className="fip-item-ref" style={{ display: "block", fontSize: "9px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.agentReference}
            </code>
          </button>
        ))}
      </div>

      {fipCopyNotice && (
        <div className="fip-copy-notice" style={{ padding: "6px 10px", background: "var(--accent-bright)", color: "#000", fontSize: "10px", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
          <Copy size={10} />
          <span>{fipCopyNotice}</span>
        </div>
      )}
    </div>
  );
};

const components = {
  canvas: DockviewCanvas,
  sidebar: DockviewSidebar,
  inspector: DockviewInspector,
  infoPanel: DockviewInfoPanel,
};

export default App;

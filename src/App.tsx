import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Check,
  Eye,
  Plus,
} from "lucide-react";
import "./App.css";
import { api, getStoredToken, setStoredToken } from "./api";
import {
  DocumentFrame,
  type DocumentFrameHandle,
} from "./components/DocumentFrame";
import { InspectorPanel, type InspectorTab } from "./components/InspectorPanel";
import {
  IconButton,
  ContextMenu,
  type ContextMenuItem,
  ToastContainer,
  Field,
  Dialog,
  NewDocumentModal,
  HorizontalScrollContainer,
} from "./components/ui";
import { triggerConfetti, toast } from "./lib/utils";
import { DEFAULT_SETTINGS } from "./lib/documentSettings";
import type {
  DocumentDetail,
  DocumentSettings,
  DocumentSummary,
  ElementEdit,
  SelectionItem,
  TemplateRecord,
} from "./types";

import { FloatingInfoPanel } from "./components/FloatingInfoPanel";
import {
  FloatingPanel,
  type PanelLayout,
} from "./components/FloatingPanel";

function getInitialSidebar(): PanelLayout {
  try {
    const saved = localStorage.getItem("hdv-sidebar-layout");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.w === "number") {
        parsed.w = Math.max(180, parsed.w);
        parsed.h = Math.max(100, parsed.h);
        if (typeof parsed.dockColumn !== "number") parsed.dockColumn = 0;
        if (typeof parsed.dockRow !== "number") parsed.dockRow = 0;
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    x: 6,
    y: 50,
    w: 220,
    h: typeof window !== "undefined" ? window.innerHeight - 50 - 32 : 600,
    isDocked: true,
    zone: "dock-left",
    minimized: false,
    visible: true,
    dockColumn: 0,
    dockRow: 0,
  };
}

function getInitialInspector(): PanelLayout {
  try {
    const saved = localStorage.getItem("hdv-inspector-layout");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.w === "number") {
        parsed.w = Math.max(240, parsed.w);
        parsed.h = Math.max(100, parsed.h);
        if (typeof parsed.dockColumn !== "number") parsed.dockColumn = 0;
        if (typeof parsed.dockRow !== "number") parsed.dockRow = 0;
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    x: typeof window !== "undefined" ? window.innerWidth - 280 - 6 : 800,
    y: 50,
    w: 280,
    h: typeof window !== "undefined" ? window.innerHeight - 50 - 32 : 600,
    isDocked: true,
    zone: "dock-right",
    minimized: false,
    visible: true,
    dockColumn: 0,
    dockRow: 0,
  };
}

function getInitialInfoPanel(): PanelLayout {
  try {
    const saved = localStorage.getItem("hdv-info-panel-layout");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.w === "number") {
        parsed.w = Math.max(180, parsed.w);
        parsed.h = Math.max(100, parsed.h);
        if (typeof parsed.dockColumn !== "number") parsed.dockColumn = 0;
        if (typeof parsed.dockRow !== "number") parsed.dockRow = 0;
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    x: 300,
    y: typeof window !== "undefined" ? window.innerHeight - 200 : 500,
    w: 320,
    h: 150,
    isDocked: false,
    zone: "free",
    minimized: false,
    visible: false,
    dockColumn: 0,
    dockRow: 0,
  };
}

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

  const [initialLayouts] = useState(() => {
    const sidebar = getInitialSidebar();
    const inspector = getInitialInspector();
    const info = getInitialInfoPanel();
    return normalizeDockLayouts(sidebar, inspector, info, false);
  });

  const [sidebarLayout, rawSetSidebarLayout] = useState<PanelLayout>(
    initialLayouts.sidebar,
  );
  const [inspectorLayout, rawSetInspectorLayout] = useState<PanelLayout>(
    initialLayouts.inspector,
  );
  const [infoPanelLayout, rawSetInfoPanelLayout] = useState<PanelLayout>(
    initialLayouts.info,
  );

  useEffect(() => {
    localStorage.setItem("hdv-sidebar-layout", JSON.stringify(sidebarLayout));
  }, [sidebarLayout]);

  useEffect(() => {
    localStorage.setItem(
      "hdv-inspector-layout",
      JSON.stringify(inspectorLayout),
    );
  }, [inspectorLayout]);

  useEffect(() => {
    localStorage.setItem(
      "hdv-info-panel-layout",
      JSON.stringify(infoPanelLayout),
    );
  }, [infoPanelLayout]);

  const getPanelLayout = (panelId: string): PanelLayout => {
    if (panelId === "sidebar") return sidebarLayout;
    if (panelId === "inspector") return inspectorLayout;
    return infoPanelLayout;
  };

  const adjustLayoutForAppearance = useCallback(
    (
      panelId: string,
      next: PanelLayout,
      currentSidebar: PanelLayout,
      currentInspector: PanelLayout,
      currentInfo: PanelLayout,
    ): PanelLayout => {
      if (next.visible && next.isDocked && next.zone !== "free") {
        const otherDockedVisible = [
          { id: "sidebar", layout: currentSidebar },
          { id: "inspector", layout: currentInspector },
          { id: "info-panel", layout: currentInfo },
        ].filter(
          (p) =>
            p.id !== panelId &&
            p.layout.isDocked &&
            p.layout.zone === next.zone &&
            p.layout.visible &&
            (p.id !== "info-panel" || selectedItems.length > 0),
        );

        if (otherDockedVisible.length > 0) {
          return {
            ...next,
            isDocked: false,
            zone: "free",
            x: next.restoreX ?? Math.max(6, (window.innerWidth - next.w) / 2),
            y: next.restoreY ?? Math.max(42, (window.innerHeight - next.h) / 2),
            w: next.restoreW ?? next.w,
            h: next.restoreH ?? next.h,
          };
        }
      }
      return next;
    },
    [selectedItems.length],
  );

  const setSidebarLayout = useCallback(
    (value: PanelLayout | ((prev: PanelLayout) => PanelLayout)) => {
      rawSetSidebarLayout((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next.visible && !prev.visible) {
          return adjustLayoutForAppearance(
            "sidebar",
            next,
            prev,
            inspectorLayout,
            infoPanelLayout,
          );
        }
        return next;
      });
    },
    [inspectorLayout, infoPanelLayout, adjustLayoutForAppearance],
  );

  const setInspectorLayout = useCallback(
    (value: PanelLayout | ((prev: PanelLayout) => PanelLayout)) => {
      rawSetInspectorLayout((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next.visible && !prev.visible) {
          return adjustLayoutForAppearance(
            "inspector",
            next,
            sidebarLayout,
            prev,
            infoPanelLayout,
          );
        }
        return next;
      });
    },
    [sidebarLayout, infoPanelLayout, adjustLayoutForAppearance],
  );

  const setInfoPanelLayout = useCallback(
    (value: PanelLayout | ((prev: PanelLayout) => PanelLayout)) => {
      rawSetInfoPanelLayout((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next.visible && !prev.visible) {
          return adjustLayoutForAppearance(
            "info-panel",
            next,
            sidebarLayout,
            inspectorLayout,
            prev,
          );
        }
        return next;
      });
    },
    [sidebarLayout, inspectorLayout, adjustLayoutForAppearance],
  );

  const getPanelStackFlags = (panelId: string) => {
    const layout = getPanelLayout(panelId);
    if (!layout.isDocked || !layout.visible) {
      return { isOnlyInColumn: true, isLastInColumn: false };
    }

    const zone = layout.zone;
    const col = layout.dockColumn;
    const colPanels = [
      { id: "sidebar", layout: sidebarLayout },
      { id: "inspector", layout: inspectorLayout },
      { id: "info-panel", layout: infoPanelLayout },
    ].filter(
      (p) =>
        p.layout.isDocked &&
        p.layout.zone === zone &&
        p.layout.dockColumn === col &&
        p.layout.visible &&
        (p.id !== "info-panel" || selectedItems.length > 0),
    );

    colPanels.sort((a, b) => (a.layout.dockRow ?? 0) - (b.layout.dockRow ?? 0));

    const isOnly = colPanels.length === 1;
    const idx = colPanels.findIndex((p) => p.id === panelId);
    const isLast = idx === colPanels.length - 1;

    return { isOnlyInColumn: isOnly, isLastInColumn: isLast };
  };

  const applyLayoutUpdates = (
    updates: Record<string, Partial<PanelLayout>>,
  ) => {
    const nextSidebar = {
      ...sidebarLayout,
      ...(updates.sidebar || updates["sidebar"]),
    };
    const nextInspector = {
      ...inspectorLayout,
      ...(updates.inspector || updates["inspector"]),
    };
    const nextInfoPanel = {
      ...infoPanelLayout,
      ...(updates.info || updates["info-panel"]),
    };

    const normalized = normalizeDockLayouts(
      nextSidebar,
      nextInspector,
      nextInfoPanel,
      selectedItems.length > 0,
    );

    setSidebarLayout(normalized.sidebar);
    setInspectorLayout(normalized.inspector);
    setInfoPanelLayout(normalized.info);
  };

  const handlePanelLayoutChange = (id: string, nextLayout: PanelLayout) => {
    if (nextLayout.isDocked) {
      const zone = nextLayout.zone;
      const col = nextLayout.dockColumn;

      const updates: Record<string, Partial<PanelLayout>> = {
        [id]: nextLayout,
      };

      if (zone === "dock-left" || zone === "dock-right") {
        // Find panels in the same column
        const colPanels = [
          { id: "sidebar", layout: sidebarLayout },
          { id: "inspector", layout: inspectorLayout },
          { id: "info-panel", layout: infoPanelLayout },
        ].filter(
          (p) =>
            p.layout.isDocked &&
            p.layout.zone === zone &&
            p.layout.dockColumn === col &&
            p.layout.visible &&
            (p.id !== "info-panel" || selectedItems.length > 0),
        );

        // Sort by dockRow
        colPanels.sort(
          (a, b) => (a.layout.dockRow ?? 0) - (b.layout.dockRow ?? 0),
        );

        // Find index of the panel being resized
        const idx = colPanels.findIndex((p) => p.id === id);

        // If it is not the last panel, we resize it against the panel below it
        if (idx !== -1 && idx < colPanels.length - 1) {
          const currentPanel = colPanels[idx];
          const nextPanel = colPanels[idx + 1];

          const currentLayout = currentPanel.layout;
          const nextLayoutObj = getPanelLayout(nextPanel.id);

          const minHeightCurrent =
            currentPanel.id === "sidebar"
              ? 120
              : currentPanel.id === "inspector"
                ? 120
                : 120;
          const minHeightNext =
            nextPanel.id === "sidebar"
              ? 120
              : nextPanel.id === "inspector"
                ? 120
                : 120;

          let requestedH = Math.max(minHeightCurrent, nextLayout.h);
          let diff = requestedH - currentLayout.h;

          let newNextH = nextLayoutObj.h - diff;
          if (newNextH < minHeightNext) {
            newNextH = minHeightNext;
            diff = nextLayoutObj.h - minHeightNext;
            requestedH = currentLayout.h + diff;
          }

          updates[id] = { ...nextLayout, h: requestedH };
          updates[nextPanel.id] = { ...nextLayoutObj, h: newNextH };
        }

        // Horizontal column-to-column resizing: resize against the adjacent column complementarily
        const currentLayout = getPanelLayout(id);
        const diffW = nextLayout.w - currentLayout.w;

        if (diffW !== 0) {
          const targetCol = zone === "dock-left" ? col + 1 : col - 1;
          const adjacentPanels = [
            { id: "sidebar", layout: sidebarLayout },
            { id: "inspector", layout: inspectorLayout },
            { id: "info-panel", layout: infoPanelLayout },
          ].filter(
            (p) =>
              p.layout.isDocked &&
              p.layout.zone === zone &&
              p.layout.dockColumn === targetCol &&
              p.layout.visible &&
              (p.id !== "info-panel" || selectedItems.length > 0),
          );

          if (adjacentPanels.length > 0) {
            const adjacentW = adjacentPanels[0].layout.w;
            const minAdjacentW = Math.max(
              ...adjacentPanels.map((p) =>
                p.id === "sidebar" ? 180 : p.id === "inspector" ? 240 : 220,
              ),
            );
            const minCurrentW =
              id === "sidebar" ? 180 : id === "inspector" ? 240 : 220;

            let requestedW = Math.max(minCurrentW, nextLayout.w);
            let actualDiff = requestedW - currentLayout.w;
            let newAdjacentW = adjacentW - actualDiff;

            if (newAdjacentW < minAdjacentW) {
              newAdjacentW = minAdjacentW;
              actualDiff = adjacentW - minAdjacentW;
              requestedW = currentLayout.w + actualDiff;
            }

            nextLayout.w = requestedW;
            updates[id] = { ...nextLayout };

            adjacentPanels.forEach((ap) => {
              const apLayout = getPanelLayout(ap.id);
              updates[ap.id] = {
                ...updates[ap.id],
                ...apLayout,
                w: newAdjacentW,
              };
            });
          }
        }

        // Also synchronize the width across all panels in this column
        const otherPanelIds = ["sidebar", "inspector", "info-panel"].filter(
          (pId) => pId !== id,
        );
        for (const pId of otherPanelIds) {
          const l = getPanelLayout(pId);
          if (l.isDocked && l.zone === zone && l.dockColumn === col) {
            updates[pId] = {
              ...updates[pId],
              ...l,
              w: nextLayout.w,
            };
          }
        }
      }

      applyLayoutUpdates(updates);
    } else {
      applyLayoutUpdates({ [id]: nextLayout });
    }
  };

  const leftDockWidth = useMemo(() => {
    const cols = new Set<number>();
    let totalW = 0;

    if (
      sidebarLayout.isDocked &&
      sidebarLayout.visible &&
      sidebarLayout.zone === "dock-left"
    ) {
      cols.add(sidebarLayout.dockColumn);
    }
    if (
      inspectorLayout.isDocked &&
      inspectorLayout.visible &&
      inspectorLayout.zone === "dock-left"
    ) {
      cols.add(inspectorLayout.dockColumn);
    }
    if (
      infoPanelLayout.isDocked &&
      infoPanelLayout.visible &&
      selectedItems.length > 0 &&
      infoPanelLayout.zone === "dock-left"
    ) {
      cols.add(infoPanelLayout.dockColumn);
    }

    cols.forEach((col) => {
      let colW = 0;
      if (
        sidebarLayout.isDocked &&
        sidebarLayout.visible &&
        sidebarLayout.zone === "dock-left" &&
        sidebarLayout.dockColumn === col
      ) {
        colW = Math.max(colW, sidebarLayout.w);
      }
      if (
        inspectorLayout.isDocked &&
        inspectorLayout.visible &&
        inspectorLayout.zone === "dock-left" &&
        inspectorLayout.dockColumn === col
      ) {
        colW = Math.max(colW, inspectorLayout.w);
      }
      if (
        infoPanelLayout.isDocked &&
        infoPanelLayout.visible &&
        selectedItems.length > 0 &&
        infoPanelLayout.zone === "dock-left" &&
        infoPanelLayout.dockColumn === col
      ) {
        colW = Math.max(colW, infoPanelLayout.w);
      }
      totalW += colW;
    });

    return totalW;
  }, [sidebarLayout, inspectorLayout, infoPanelLayout, selectedItems]);

  const rightDockWidth = useMemo(() => {
    const cols = new Set<number>();
    let totalW = 0;

    if (
      sidebarLayout.isDocked &&
      sidebarLayout.visible &&
      sidebarLayout.zone === "dock-right"
    ) {
      cols.add(sidebarLayout.dockColumn);
    }
    if (
      inspectorLayout.isDocked &&
      inspectorLayout.visible &&
      inspectorLayout.zone === "dock-right"
    ) {
      cols.add(inspectorLayout.dockColumn);
    }
    if (
      infoPanelLayout.isDocked &&
      infoPanelLayout.visible &&
      selectedItems.length > 0 &&
      infoPanelLayout.zone === "dock-right"
    ) {
      cols.add(infoPanelLayout.dockColumn);
    }

    cols.forEach((col) => {
      let colW = 0;
      if (
        sidebarLayout.isDocked &&
        sidebarLayout.visible &&
        sidebarLayout.zone === "dock-right" &&
        sidebarLayout.dockColumn === col
      ) {
        colW = Math.max(colW, sidebarLayout.w);
      }
      if (
        inspectorLayout.isDocked &&
        inspectorLayout.visible &&
        inspectorLayout.zone === "dock-right" &&
        inspectorLayout.dockColumn === col
      ) {
        colW = Math.max(colW, inspectorLayout.w);
      }
      if (
        infoPanelLayout.isDocked &&
        infoPanelLayout.visible &&
        selectedItems.length > 0 &&
        infoPanelLayout.zone === "dock-right" &&
        infoPanelLayout.dockColumn === col
      ) {
        colW = Math.max(colW, infoPanelLayout.w);
      }
      totalW += colW;
    });

    return totalW;
  }, [sidebarLayout, inspectorLayout, infoPanelLayout, selectedItems]);

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
      setInfoPanelLayout((prev) =>
        prev.visible ? prev : { ...prev, visible: true },
      );
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
          label: sidebarLayout.visible ? "Hide Sidebar" : "Show Sidebar",
          onClick: () =>
            setSidebarLayout((prev) => ({ ...prev, visible: !prev.visible })),
        },
        {
          label: inspectorLayout.visible ? "Hide Inspector" : "Show Inspector",
          onClick: () =>
            setInspectorLayout((prev) => ({ ...prev, visible: !prev.visible })),
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
            navigator.clipboard.writeText(refStr);
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
            navigator.clipboard.writeText(html);
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
          navigator.clipboard.writeText(doc.relativePath);
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
          navigator.clipboard.writeText(doc.relativePath);
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
  const hasUnsavedChanges = pendingCount > 0 || settingsDirty;
  const activeTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );

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
      setSelectedItems([]);
      setAncestors([]);
      setReloadToken((value) => value + 1);
      setActiveView("editor");
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
  }

  function handleElementEdit(edit: Omit<ElementEdit, "targetPath">) {
    if (!selectedItems.length) {
      return;
    }

    const nextPending = { ...pendingEdits };
    for (const item of selectedItems) {
      const fullEdit: ElementEdit = { ...edit, targetPath: item.path };
      frameRef.current?.applyElementEdit(fullEdit);
      nextPending[item.path] = mergeEdits(nextPending[item.path], fullEdit);
    }
    setPendingEdits(nextPending);
  }

  function discardLocalChanges() {
    if (!activeDocument) {
      return;
    }
    setPendingEdits({});
    setSettingsDirty(false);
    setSelectedItems([]);
    setReloadToken((value) => value + 1);
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
      });
      setPendingEdits({});
      setSettingsDirty(false);
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
        setSidebarLayout((prev) => ({ ...prev, visible: !prev.visible }));
      }

      if (isMeta && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setInspectorLayout((prev) => ({ ...prev, visible: !prev.visible }));
      }

      if (isMeta && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setInfoPanelLayout((prev) => ({ ...prev, visible: !prev.visible }));
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
    sidebarLayout,
    inspectorLayout,
    infoPanelLayout,
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
        action: () =>
          setSidebarLayout((prev) => ({ ...prev, visible: !prev.visible })),
      },
      {
        label: "Toggle Inspector",
        category: "View",
        shortcut: "⌘⇧R",
        action: () =>
          setInspectorLayout((prev) => ({ ...prev, visible: !prev.visible })),
      },
      {
        label: "Toggle Selection Info Panel",
        category: "View",
        shortcut: "⌘⇧I",
        action: () =>
          setInfoPanelLayout((prev) => ({ ...prev, visible: !prev.visible })),
      },
      {
        label: "Toggle Zen Mode",
        category: "View",
        shortcut: "⌘.",
        action: () => setZenMode((z) => !z),
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
      <div className="library-screen-container">
        {/* Center Canvas Grid */}
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
                onChange={(event) => setLibrarySearch(event.target.value)}
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
                  onClick={() => handleTemplateSelection(template.id)}
                  onContextMenu={(e) => handleTemplateContextMenu(e, template)}
                  onDoubleClick={() => {
                    handleTemplateSelection(template.id);
                    setActiveView("editor");
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

        {/* Right Details Pane (Xcode Style Inspector) */}
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
                      setRenameTemplateName(event.target.value)
                    }
                    placeholder="Enter new template name…"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: "100%", minHeight: 28, fontSize: 11 }}
                  disabled={!renameTemplateName.trim()}
                  onClick={renameTemplate}
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
                    onClick={() => setActiveView("editor")}
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
                    onClick={deleteTemplate}
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

  function renderSettingsScreen() {
    return (
      <div className="settings-screen-container">
        <div className="settings-grid-column">
          <div className="settings-header">
            <h2>Preferences</h2>
            <span>
              Configure security parameters, interface styling, and theme
              preferences
            </span>
          </div>

          <div className="settings-content-scroll">
            <div className="settings-form-box">
              <h3>Remote Security Settings</h3>
              <p className="settings-desc">
                Provide an authorization token to enable write/export options
                for remote servers.
              </p>
              <div className="settings-row-input">
                <input
                  value={tokenInput}
                  type="password"
                  onChange={(event) => updateToken(event.target.value)}
                  placeholder="Enter remote secure access token…"
                  style={{ maxWidth: 360 }}
                />
              </div>

              <div className="settings-divider" />

              <h3>Interface Customization</h3>
              <p className="settings-desc">
                Change the interface theme and accent highlight.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  marginTop: 12,
                  marginBottom: 16,
                }}
              >
                <Field label="System Accent">
                  <select
                    value={accent}
                    onChange={(e) =>
                      setAccent(
                        e.target.value as
                          | "blue"
                          | "purple"
                          | "teal"
                          | "orange"
                          | "rose",
                      )
                    }
                    style={{ minWidth: 160 }}
                  >
                    <option value="blue">Blue (Apple Default)</option>
                    <option value="purple">Purple (Vibrant)</option>
                    <option value="teal">Teal (Ocean)</option>
                    <option value="orange">Orange (Warm)</option>
                    <option value="rose">Rose (Sunset)</option>
                  </select>
                </Field>

                <Field label="System Theme">
                  <select
                    value={theme}
                    onChange={(e) =>
                      setTheme(
                        e.target.value as
                          | "system"
                          | "dark"
                          | "light"
                          | "true-black",
                      )
                    }
                    style={{ minWidth: 160 }}
                  >
                    <option value="system">System Default</option>
                    <option value="dark">macOS Dark</option>
                    <option value="light">macOS Light</option>
                    <option value="true-black">OLED True Black</option>
                  </select>
                </Field>
              </div>

              <div className="settings-divider" />

              <h3>Status Info</h3>
              <div className="settings-info-grid">
                <div className="info-row">
                  <span>Active Documents</span>
                  <strong>{documents.length} files loaded</strong>
                </div>
                <div className="info-row">
                  <span>Template Components</span>
                  <strong>{templates.length} elements saved</strong>
                </div>
              </div>

              <div className="settings-divider" />

              <div className="settings-actions-bar">
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: "auto" }}
                  onClick={() => setActiveView("editor")}
                >
                  Return to Document Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cascadeFloatingPanels = () => {
    const visiblePanels = [
      { id: "sidebar", layout: sidebarLayout, set: setSidebarLayout },
      { id: "inspector", layout: inspectorLayout, set: setInspectorLayout },
      { id: "info-panel", layout: infoPanelLayout, set: setInfoPanelLayout },
    ].filter(
      (p) =>
        p.layout.visible && (p.id !== "info-panel" || selectedItems.length > 0),
    );

    visiblePanels.forEach((p, idx) => {
      p.set({
        ...p.layout,
        isDocked: false,
        maximized: false,
        w: 320,
        h: 400,
        x: 60 + idx * 40,
        y: 80 + idx * 40,
      });
    });

    toast("Windows cascaded", "success");
  };

  const tileFloatingPanels = () => {
    const visiblePanels = [
      { id: "sidebar", layout: sidebarLayout, set: setSidebarLayout },
      { id: "inspector", layout: inspectorLayout, set: setInspectorLayout },
      { id: "info-panel", layout: infoPanelLayout, set: setInfoPanelLayout },
    ].filter(
      (p) =>
        p.layout.visible && (p.id !== "info-panel" || selectedItems.length > 0),
    );

    if (visiblePanels.length === 0) return;

    const N = visiblePanels.length;
    const padding = 6;
    const topOffset = 36; // TOPBAR_H
    const bottomOffset = 16; // FOOTER_H

    const w = (window.innerWidth - padding * (N + 1)) / N;
    const h = window.innerHeight - topOffset - bottomOffset - padding * 2;

    visiblePanels.forEach((p, idx) => {
      p.set({
        ...p.layout,
        isDocked: false,
        maximized: false,
        w: w,
        h: h,
        x: padding + idx * (w + padding),
        y: topOffset + padding,
      });
    });

    toast("Windows tiled", "success");
  };

  const dockAllPanels = () => {
    setSidebarLayout((prev) => ({
      ...prev,
      isDocked: true,
      maximized: false,
      zone: "dock-left",
      dockColumn: 0,
      dockRow: 0,
    }));
    setInspectorLayout((prev) => ({
      ...prev,
      isDocked: true,
      maximized: false,
      zone: "dock-right",
      dockColumn: 0,
      dockRow: 0,
    }));
    setInfoPanelLayout((prev) => ({
      ...prev,
      isDocked: true,
      maximized: false,
      zone: "dock-right",
      dockColumn: 0,
      dockRow: 0,
    }));
    toast("All panels docked", "success");
  };

  const floatAllPanels = () => {
    setSidebarLayout((prev) => ({
      ...prev,
      isDocked: false,
      maximized: false,
      x: 50,
      y: 80,
      w: 240,
      h: 500,
    }));
    setInspectorLayout((prev) => ({
      ...prev,
      isDocked: false,
      maximized: false,
      x: window.innerWidth - 300 - 6,
      y: 80,
      w: 280,
      h: 500,
    }));
    setInfoPanelLayout((prev) => ({
      ...prev,
      isDocked: false,
      maximized: false,
      x: 350,
      y: 150,
      w: 320,
      h: 180,
    }));
    toast("All panels floated", "success");
  };

  const resetWindowLayout = () => {
    setSidebarLayout({
      x: 6,
      y: 42,
      w: 220,
      h: window.innerHeight - 36 - 16 - 12,
      isDocked: true,
      zone: "dock-left",
      minimized: false,
      visible: true,
      dockColumn: 0,
      dockRow: 0,
      maximized: false,
    });
    setInspectorLayout({
      x: window.innerWidth - 280 - 6,
      y: 42,
      w: 280,
      h: window.innerHeight - 36 - 16 - 12,
      isDocked: true,
      zone: "dock-right",
      minimized: false,
      visible: true,
      dockColumn: 0,
      dockRow: 0,
      maximized: false,
    });
    setInfoPanelLayout({
      x: 300,
      y: window.innerHeight - 200,
      w: 320,
      h: 150,
      isDocked: false,
      zone: "free",
      minimized: false,
      visible: false,
      dockColumn: 0,
      dockRow: 0,
      maximized: false,
    });
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
              void navigator.clipboard.writeText(
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
          onClick: () =>
            setSidebarLayout((prev) => ({ ...prev, visible: !prev.visible })),
          shortcut: "⌘⇧L",
        },
        {
          label: "Inspector",
          onClick: () =>
            setInspectorLayout((prev) => ({ ...prev, visible: !prev.visible })),
          shortcut: "⌘⇧R",
        },
        {
          label: "Selection Info Panel",
          onClick: () =>
            setInfoPanelLayout((prev) => ({ ...prev, visible: !prev.visible })),
          shortcut: "⌘⇧I",
        },
        { divider: true },
        {
          label: "Toggle Zen Mode",
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

  const renderSidebar = (isOnlyInColumn = true, isLastInColumn = false) => {

    return (
      <FloatingPanel
        id="sidebar"
        title="Navigator"
        layout={sidebarLayout}
        onLayoutChange={(next) => handlePanelLayoutChange("sidebar", next)}
        allowedZones={["free", "dock-left", "dock-right"]}
        workspaceRef={shellRef}
        minWidth={180}
        minHeight={120}
        isOnlyInColumn={isOnlyInColumn}
        isLastInColumn={isLastInColumn}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
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
                    className={
                      activeView === "editor"
                        ? "nav-row nav-row--active"
                        : "nav-row"
                    }
                    onClick={() => setActiveView("editor")}
                  >
                    <FileText size={12} />
                    <span>Document Editor</span>
                  </button>
                  <button
                    className={
                      activeView === "library"
                        ? "nav-row nav-row--active"
                        : "nav-row"
                    }
                    onClick={() => setActiveView("library")}
                  >
                    <Library size={12} />
                    <span>Component Library</span>
                  </button>
                  <button
                    className={
                      activeView === "settings"
                        ? "nav-row nav-row--active"
                        : "nav-row"
                    }
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
                  {filteredDocuments.map((document) => (
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
      </FloatingPanel>
    );
  };

  const renderInspector = (isOnlyInColumn = true, isLastInColumn = false) => {
    return (
      <FloatingPanel
        id="inspector"
        title="Inspector"
        layout={inspectorLayout}
        onLayoutChange={(next) => handlePanelLayoutChange("inspector", next)}
        allowedZones={["free", "dock-left", "dock-right"]}
        workspaceRef={shellRef}
        minWidth={240}
        minHeight={120}
        isOnlyInColumn={isOnlyInColumn}
        isLastInColumn={isLastInColumn}
      >
        <InspectorPanel
          activeTab={activeInspectorTab}
          selectedItems={selectedItems}
          settings={settings}
          settingsDirty={settingsDirty}
          pendingChangeCount={pendingCount}
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
        />
      </FloatingPanel>
    );
  };

  const renderInfoPanel = (isOnlyInColumn = true, isLastInColumn = false) => {
    if (selectedItems.length === 0) return null;
    return (
      <FloatingInfoPanel
        items={selectedItems}
        copyNotice={fipCopyNotice}
        workspaceRef={shellRef}
        layout={infoPanelLayout}
        onLayoutChange={(next) => handlePanelLayoutChange("info-panel", next)}
        isOnlyInColumn={isOnlyInColumn}
        isLastInColumn={isLastInColumn}
        onCopyAll={() => {
          void navigator.clipboard
            .writeText(selectedItems.map((i) => i.agentReference).join("\n"))
            .then(() => {
              setFipCopyNotice("All references copied");
              setTimeout(() => setFipCopyNotice(""), 1800);
            });
        }}
        onCopyItem={(ref) => {
          void navigator.clipboard.writeText(ref).then(() => {
            setFipCopyNotice("Copied");
            setTimeout(() => setFipCopyNotice(""), 1800);
          });
        }}
      />
    );
  };

  const renderDockZone = (zone: "dock-left" | "dock-right") => {
    const panels: {
      id: string;
      layout: PanelLayout;
      render: (isOnly: boolean, isLast?: boolean) => React.ReactNode;
    }[] = [];

    if (
      sidebarLayout.isDocked &&
      sidebarLayout.visible &&
      sidebarLayout.zone === zone
    ) {
      panels.push({
        id: "sidebar",
        layout: sidebarLayout,
        render: renderSidebar,
      });
    }
    if (
      inspectorLayout.isDocked &&
      inspectorLayout.visible &&
      inspectorLayout.zone === zone
    ) {
      panels.push({
        id: "inspector",
        layout: inspectorLayout,
        render: renderInspector,
      });
    }
    if (
      infoPanelLayout.isDocked &&
      infoPanelLayout.visible &&
      selectedItems.length > 0 &&
      infoPanelLayout.zone === zone
    ) {
      panels.push({
        id: "info-panel",
        layout: infoPanelLayout,
        render: renderInfoPanel,
      });
    }

    // Keep columns 0, 1, 2 permanently mounted to support smooth flexbox width transitions
    const columns: Record<number, typeof panels> = {
      0: [],
      1: [],
      2: [],
    };
    for (const p of panels) {
      const col = p.layout.dockColumn ?? 0;
      if (!columns[col]) columns[col] = [];
      columns[col].push(p);
    }

    const colKeys = Object.keys(columns)
      .map(Number)
      .sort((a, b) => a - b);

    // Calculate total size for smooth CSS transitions
    let totalW = 0;
    let totalH = 0;

    if (zone === "dock-left" || zone === "dock-right") {
      for (const colKey of colKeys) {
        const colPanels = columns[colKey];
        if (colPanels.length > 0) {
          const w = colPanels[0]?.layout.w ?? 240;
          totalW += w;
        }
      }
    }

    // Set inline styles depending on zone
    const containerStyle: React.CSSProperties = {};
    if (zone === "dock-left" || zone === "dock-right") {
      containerStyle.width = `${totalW}px`;
    }

    const populatedCols = colKeys.filter(
      (colKey) => columns[colKey].length > 0,
    );
    const isOnlyCol = populatedCols.length === 1;

    return (
      <div
        className={`dock-zone-content dock-zone-content--${zone} ${panels.length === 0 ? "dock-zone-content--empty" : ""}`}
        style={containerStyle}
      >
        {colKeys.map((colKey) => {
          const colPanels = columns[colKey];

          if (colPanels.length === 0) {
            return (
              <div
                key={colKey}
                className="dock-column dock-column--empty"
                style={{
                  width: 0,
                  overflow: "hidden",
                  flex: "0 0 auto",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                data-dock-column={colKey}
              />
            );
          }

          colPanels.sort(
            (a, b) => (a.layout.dockRow ?? 0) - (b.layout.dockRow ?? 0),
          );

          const firstPanel = colPanels[0];
          const w = firstPanel?.layout.w ?? 240;

          const colStyle: React.CSSProperties = {
              width: w,
              flex: "0 0 auto",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            };

          return (
            <div
              key={colKey}
              className="dock-column"
              style={colStyle}
              data-dock-column={colKey}
            >
              {colPanels.map((p) => {
                const isOnly = colPanels.length === 1;
                const h = p.layout.h;

                const placeholderStyle: React.CSSProperties = {
                  width: "100%",
                  height: p.layout.minimized
                    ? "32px"
                    : isOnly
                      ? "100%"
                      : "auto",
                  flex: p.layout.minimized
                    ? "0 0 auto"
                    : isOnly
                      ? "1 1 auto"
                      : `${h} ${h} 0%`,
                  minHeight: p.layout.minimized ? "32px" : "100px",
                };

                return (
                  <div
                    key={p.id}
                    id={`placeholder-${p.id}`}
                    className={`dock-placeholder ${p.layout.minimized ? "dock-placeholder--minimized" : ""}`}
                    style={placeholderStyle}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
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
                setInspectorLayout((prev) => ({ ...prev, visible: true }));
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
      <div
        className={`workspace-grid ${!sidebarLayout.isDocked || !sidebarLayout.visible ? "grid--no-sidebar" : ""} ${!inspectorLayout.isDocked || !inspectorLayout.visible || activeView !== "editor" ? "grid--no-inspector" : ""}`}
      >
        {activeView === "editor" && (
          <>
            {/* Left Dock Container */}
            <div className="dock-container dock-container--left">
              {renderDockZone("dock-left")}
            </div>

            {/* ── CANVAS ─────────────────────────────────────────── */}
            <section
              className="canvas-column"
              ref={canvasRef}
              onContextMenu={handleCanvasContextMenu}
            >
              {/* Document Tab Bar (Item 24) */}
              {openDocIds.length > 0 && (
                <div className="document-tab-bar">
                  <div className="document-tab-bar-scroll">
                    {openDocIds.map((docId) => {
                      const doc = documents.find((d) => d.id === docId);
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
                {ancestors.map((ancestor, index) => (
                  <span
                    key={`${ancestor.path}-${index}`}
                    className="breadcrumb-item-wrapper"
                  >
                    <button
                      type="button"
                      className="breadcrumb-item"
                      onClick={() => {
                        if (frameRef.current) {
                          frameRef.current.selectElementByPath(ancestor.path);
                        }
                      }}
                    >
                      {ancestor.tag}
                    </button>
                    {index < ancestors.length - 1 && (
                      <span className="breadcrumb-divider">&gt;</span>
                    )}
                  </span>
                ))}
              </div>

              {/* Canvas Content Wrapper (nested flex layout for bottom docking) */}
              <div className="canvas-content-wrapper">
                {/* Document frame — with mode-switch tint class (#51) */}
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
                  shellClassName={
                    selectorEnabled
                      ? "document-frame-shell--select"
                      : "document-frame-shell--preview"
                  }
                />

              </div>
            </section>

            {/* Right Dock Container */}
            <div className="dock-container dock-container--right">
              {renderDockZone("dock-right")}
            </div>

            {/* Fixed overlay panels (automatically aligned to placeholders when docked) */}
            {sidebarLayout.visible &&
              renderSidebar(
                getPanelStackFlags("sidebar").isOnlyInColumn,
                getPanelStackFlags("sidebar").isLastInColumn,
              )}
            {inspectorLayout.visible &&
              renderInspector(
                getPanelStackFlags("inspector").isOnlyInColumn,
                getPanelStackFlags("inspector").isLastInColumn,
              )}
            {infoPanelLayout.visible &&
              selectedItems.length > 0 &&
              renderInfoPanel(
                getPanelStackFlags("info-panel").isOnlyInColumn,
                getPanelStackFlags("info-panel").isLastInColumn,
              )}
          </>
        )}

        {activeView === "library" && renderLibraryScreen()}
        {activeView === "settings" && renderSettingsScreen()}
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

function mergeEdits(
  existing: ElementEdit | undefined,
  incoming: ElementEdit,
): ElementEdit {
  return {
    targetPath: incoming.targetPath,
    styles: { ...(existing?.styles || {}), ...(incoming.styles || {}) },
    attributes: {
      ...(existing?.attributes || {}),
      ...(incoming.attributes || {}),
    },
    textContent: incoming.textContent ?? existing?.textContent,
  };
}

const PADDING = 6;
const TOPBAR_H = 36;
const FOOTER_H = 16;

function pushFloatingPanel(
  l: PanelLayout,
  leftW: number,
  rightW: number,
): PanelLayout {
  if (l.isDocked || !l.visible || l.maximized) return l;

  const next = { ...l };
  const leftBoundary = leftW + PADDING;
  const rightBoundary = window.innerWidth - rightW - PADDING;

  // Push right if overlapping left dock
  if (next.x < leftBoundary) {
    next.x = leftBoundary;
  }

  // Push left if overlapping right dock
  if (next.x + next.w > rightBoundary) {
    next.x = Math.max(leftBoundary, rightBoundary - next.w);
  }

  return next;
}

function normalizeDockLayouts(
  sidebar: PanelLayout,
  inspector: PanelLayout,
  info: PanelLayout,
  isInfoActive: boolean,
): { sidebar: PanelLayout; inspector: PanelLayout; info: PanelLayout } {
  const next = {
    sidebar: { ...sidebar },
    inspector: { ...inspector },
    info: { ...info },
  };

  const isVisible = (name: string, l: PanelLayout) => {
    if (name === "info") return l.visible && isInfoActive;
    return l.visible;
  };

  const zones: ("dock-left" | "dock-right")[] = [
    "dock-left",
    "dock-right",
  ];

  for (const zone of zones) {
    let docked = Object.entries(next).filter(
      ([name, l]) => l.isDocked && l.zone === zone && isVisible(name, l),
    );

    if (docked.length === 0) continue;

    const columns: Record<number, typeof docked> = {};
    for (const item of docked) {
      const col = item[1].dockColumn ?? 0;
      if (!columns[col]) columns[col] = [];
      columns[col].push(item);
    }

    const sortedColKeys = Object.keys(columns)
      .map(Number)
      .sort((a, b) => a - b);

    sortedColKeys.forEach((colKey, colIdx) => {
      const colItems = columns[colKey];
      colItems.sort((a, b) => (a[1].dockRow ?? 0) - (b[1].dockRow ?? 0));
      colItems.forEach((item, rowIdx) => {
        const pName = item[0] as "sidebar" | "inspector" | "info";
        next[pName].dockColumn = colIdx;
        next[pName].dockRow = rowIdx;
      });
    });
  }

  const getVisibleDocked = (
    zone: "dock-left" | "dock-right",
  ) => {
    return [
      { id: "sidebar", layout: next.sidebar },
      { id: "inspector", layout: next.inspector },
      { id: "info", layout: next.info },
    ]
      .filter(
        (p) =>
          p.layout.isDocked &&
          p.layout.zone === zone &&
          isVisible(p.id, p.layout),
      )
      .map((p) => p.layout);
  };

  // Calculate active dock zone dimensions to push floating windows
  const leftPanels = getVisibleDocked("dock-left");
  const rightPanels = getVisibleDocked("dock-right");

  // Compute left dock width
  const leftCols: Record<number, typeof leftPanels> = {};
  for (const p of leftPanels) {
    const col = p.dockColumn ?? 0;
    if (!leftCols[col]) leftCols[col] = [];
    leftCols[col].push(p);
  }
  let leftW = 0;
  for (const colKey in leftCols) {
    const colPanels = leftCols[colKey];
    leftW += colPanels[0]?.w ?? 240;
  }

  // Compute right dock width
  const rightCols: Record<number, typeof rightPanels> = {};
  for (const p of rightPanels) {
    const col = p.dockColumn ?? 0;
    if (!rightCols[col]) rightCols[col] = [];
    rightCols[col].push(p);
  }
  let rightW = 0;
  for (const colKey in rightCols) {
    const colPanels = rightCols[colKey];
    rightW += colPanels[0]?.w ?? 240;
  }

  // Push any floating panels away from left/right docks
  next.sidebar = pushFloatingPanel(next.sidebar, leftW, rightW);
  next.inspector = pushFloatingPanel(next.inspector, leftW, rightW);
  next.info = pushFloatingPanel(next.info, leftW, rightW);

  return next;
}

export default App;

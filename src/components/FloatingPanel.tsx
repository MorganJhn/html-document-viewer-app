/**
 * FloatingPanel
 * A reusable container that can be docked (inline inside the grid, pushing canvas)
 * or floated (absolutely positioned, overlapping canvas).
 * It supports title bar dragging (tear-off), 8-direction resizing when floating,
 * border-resizing when docked, snapping to edges with ghost previews, and minimization.
 */
import React, { useCallback, useRef, useState, useEffect } from "react";
import { GripVertical, Minimize2, X, Maximize2 } from "lucide-react";

export type SnapZone = "free" | "dock-left" | "dock-right" | "dock-bottom";

export interface PanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  isDocked: boolean;
  zone: SnapZone;
  minimized: boolean;
  visible: boolean;
  dockColumn: number;
  dockRow: number;
  maximized?: boolean;
  restoreX?: number;
  restoreY?: number;
  restoreW?: number;
  restoreH?: number;
}

interface FloatingPanelProps {
  id: string;
  title: string;
  titleActions?: React.ReactNode;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  allowedZones: SnapZone[];
  workspaceRef: React.RefObject<HTMLElement | null>;
  minWidth?: number;
  minHeight?: number;
  isOnlyInColumn?: boolean;
  isLastInColumn?: boolean;
  reservedBottomSpace?: number;
  allowBottomDock?: boolean;
  children: React.ReactNode;
}

const SNAP_THRESHOLD = 40; // px from canvas edge to trigger a snap zone
const DRAG_THRESHOLD = 4; // px mouse must move before drag/resize activates
const SNAP_DELAY = 150; // ms to wait before snapping a dragged panel
const TOPBAR_H = 36; // topbar height in px
const FOOTER_H = 16; // footer status bar height in px
const TITLEBAR_H = 32; // titlebar height in px
const PADDING = 6;
export const BOTTOM_DOCK_HEIGHT = 448;

const EDGE_CURSORS: Record<string, string> = {
  n: "n-resize",
  s: "s-resize",
  e: "e-resize",
  w: "w-resize",
  nw: "nw-resize",
  ne: "ne-resize",
  sw: "sw-resize",
  se: "se-resize",
};

function calcSnap(
  _id: string,
  z: SnapZone,
  ws: DOMRect,
  fallbackX: number,
  fallbackY: number,
  fallbackW: number,
  fallbackH: number,
): { x: number; y: number; w: number; h: number } {
  const topOffset = TOPBAR_H;
  const bottomOffset = FOOTER_H;

  switch (z) {
    case "dock-left":
      return {
        x: ws.left + PADDING,
        y: ws.top + topOffset + PADDING,
        w: fallbackW || 220,
        h: ws.height - topOffset - bottomOffset - PADDING * 2,
      };
    case "dock-right":
      return {
        x: ws.left + ws.width - (fallbackW || 280) - PADDING,
        y: ws.top + topOffset + PADDING,
        w: fallbackW || 280,
        h: ws.height - topOffset - bottomOffset - PADDING * 2,
      };
    case "dock-bottom":
      return {
        x: ws.left + PADDING,
        y: ws.top + ws.height - bottomOffset - BOTTOM_DOCK_HEIGHT - PADDING,
        w: ws.width - PADDING * 2,
        h: BOTTOM_DOCK_HEIGHT,
      };
    default:
      return { x: fallbackX, y: fallbackY, w: fallbackW, h: fallbackH };
  }
}

export function FloatingPanel({
  id,
  title,
  titleActions,
  layout,
  onLayoutChange,
  allowedZones,
  workspaceRef,
  minWidth = 180,
  minHeight = 100,
  isOnlyInColumn = true,
  isLastInColumn = false,
  reservedBottomSpace = 0,
  allowBottomDock = true,
  children,
}: FloatingPanelProps) {
  const { x, y, w, h, isDocked, zone, minimized, visible } = layout;

  // Enforce minWidth/minHeight and offscreen bounds constraints
  useEffect(() => {
    if (!visible) return;

    function clampBounds() {
      let corrected = false;
      const nextLayout = { ...layout };

      if (nextLayout.w < minWidth) {
        nextLayout.w = minWidth;
        corrected = true;
      }
      if (nextLayout.h < minHeight) {
        nextLayout.h = minHeight;
        corrected = true;
      }

      if (!isDocked) {
        // Clamp width and height first
        if (nextLayout.w > window.innerWidth - PADDING * 2) {
          nextLayout.w = Math.max(minWidth, window.innerWidth - PADDING * 2);
          if (nextLayout.w !== layout.w) corrected = true;
        }
        const availableHeight =
          window.innerHeight -
          TOPBAR_H -
          FOOTER_H -
          PADDING * 2 -
          reservedBottomSpace;
        if (nextLayout.h > availableHeight) {
          nextLayout.h = Math.max(minHeight, availableHeight);
          if (nextLayout.h !== layout.h) corrected = true;
        }

        const minLimitX = PADDING;
        const maxLimitX = window.innerWidth - nextLayout.w - PADDING;
        const minLimitY = TOPBAR_H + PADDING;
        const maxLimitY =
          window.innerHeight -
          FOOTER_H -
          PADDING -
          TITLEBAR_H -
          reservedBottomSpace;

        if (nextLayout.x < minLimitX || nextLayout.x > maxLimitX) {
          nextLayout.x = Math.max(minLimitX, Math.min(nextLayout.x, maxLimitX));
          if (nextLayout.x !== layout.x) corrected = true;
        }
        if (nextLayout.y < minLimitY || nextLayout.y > maxLimitY) {
          nextLayout.y = Math.max(minLimitY, Math.min(nextLayout.y, maxLimitY));
          if (nextLayout.y !== layout.y) corrected = true;
        }
      }

      if (corrected) {
        onLayoutChange(nextLayout);
      }
    }

    clampBounds();

    window.addEventListener("resize", clampBounds);
    return () => window.removeEventListener("resize", clampBounds);
  }, [
    layout,
    minWidth,
    minHeight,
    onLayoutChange,
    visible,
    isDocked,
    id,
    reservedBottomSpace,
  ]);

  const [dockedRect, setDockedRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const updateDockedRect = useCallback(() => {
    if (!isDocked || !visible) {
      if (dockedRect !== null) setDockedRect(null);
      return;
    }
    const placeholder = document.getElementById(`placeholder-${id}`);
    if (placeholder) {
      const rect = placeholder.getBoundingClientRect();
      if (
        !dockedRect ||
        dockedRect.left !== rect.left ||
        dockedRect.top !== rect.top ||
        dockedRect.width !== rect.width ||
        dockedRect.height !== rect.height
      ) {
        setDockedRect({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }
  }, [id, isDocked, visible, dockedRect]);

  useEffect(() => {
    if (!isDocked || !visible) return;

    const handleUpdate = () => {
      requestAnimationFrame(updateDockedRect);
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    const placeholder = document.getElementById(`placeholder-${id}`);
    if (placeholder) {
      const observer = new ResizeObserver(handleUpdate);
      observer.observe(placeholder);

      handleUpdate();

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", handleUpdate);
        window.removeEventListener("scroll", handleUpdate, true);
      };
    }

    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [isDocked, visible, id, updateDockedRect]);

  const [captureCursor, setCaptureCursor] = useState<string | null>(null);

  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPanelX: number;
    startPanelY: number;
    started: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    edge: string;
    startMouseX: number;
    startMouseY: number;
    startW: number;
    startH: number;
    startX: number;
    startY: number;
    started: boolean;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastSnapRef = useRef<{
    zone: SnapZone;
    dockColumn: number;
    dockRow: number;
    x: number;
    y: number;
    w: number;
    h: number;
    maximized?: boolean;
  } | null>(null);

  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapRef = useRef<{
    zone: SnapZone;
    dockColumn: number;
    dockRow: number;
    x: number;
    y: number;
    w: number;
    h: number;
    maximized?: boolean;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) {
        clearTimeout(snapTimerRef.current);
      }
    };
  }, []);

  const originalZoneRef = useRef<SnapZone | null>(null);
  const originalPanelRectRef = useRef<DOMRect | null>(null);
  const hasLeftOriginalZoneRef = useRef<boolean>(false);
  const localIsDockedRef = useRef<boolean>(false);
  const originalDockColumnRef = useRef<number>(0);
  const originalDockRowRef = useRef<number>(0);
  const undockTimeRef = useRef<number | null>(null);

  const detectZone = useCallback(
    (mouseX: number, mouseY: number, ws: DOMRect): SnapZone | null => {
      const relX = mouseX - ws.left;
      const relY = mouseY - ws.top;
      if (allowedZones.includes("dock-left") && relX < SNAP_THRESHOLD)
        return "dock-left";
      if (
        allowedZones.includes("dock-right") &&
        relX > ws.width - SNAP_THRESHOLD
      )
        return "dock-right";
      if (
        allowedZones.includes("dock-bottom") &&
        allowBottomDock &&
        relY > ws.height - SNAP_THRESHOLD
      )
        return "dock-bottom";
      return null;
    },
    [allowedZones, allowBottomDock],
  );

  // ── Drag title bar ──────────────────────────────────────────────────────────
  const handleTitlebarMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        (e.target as HTMLElement).closest("button") ||
        (e.target as HTMLElement).closest("select") ||
        (e.target as HTMLElement).closest("input")
      )
        return;
      e.preventDefault();

      const rect = panelRef.current?.getBoundingClientRect();
      const startX = rect ? rect.left : x;
      const startY = rect ? rect.top : y;
      let isMaximized = layout.maximized;

      originalZoneRef.current = layout.isDocked ? layout.zone : null;
      originalPanelRectRef.current = rect || null;
      originalDockColumnRef.current = layout.dockColumn ?? 0;
      originalDockRowRef.current = layout.dockRow ?? 0;
      hasLeftOriginalZoneRef.current = false;
      localIsDockedRef.current = layout.isDocked;
      undockTimeRef.current = null;

      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startPanelX: startX,
        startPanelY: startY,
        started: false,
      };

      setCaptureCursor("grabbing");
      document.body.classList.add("fip-active-operation");
      document.body.classList.add("fip-dragging");
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      function onMove(me: MouseEvent) {
        const dr = dragRef.current;
        if (!dr) return;

        let dx = me.clientX - dr.startMouseX;
        let dy = me.clientY - dr.startMouseY;

        let currentW = w;
        let currentH = h;
        let localMaximized = isMaximized;
        let nextRestoreX = layout.restoreX;
        let nextRestoreY = layout.restoreY;
        let nextRestoreW = layout.restoreW;
        let nextRestoreH = layout.restoreH;

        if (!dr.started) {
          if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD)
            return;
          dr.started = true;

          if (localMaximized) {
            const restoredW = layout.restoreW ?? w;
            const restoredH = layout.restoreH ?? h;
            const relativeX = (dr.startMouseX - dr.startPanelX) / w;
            const newPanelX = dr.startMouseX - restoredW * relativeX;

            // Reset start coordinates to current mouse position so subsequent dx/dy calculations start from here
            dr.startMouseX = me.clientX;
            dr.startMouseY = me.clientY;
            dr.startPanelX = newPanelX;
            dr.startPanelY = me.clientY - 16; // keep titlebar under cursor

            dx = 0;
            dy = 0;
            localMaximized = false;
            isMaximized = false;
            currentW = restoredW;
            currentH = restoredH;
            nextRestoreX = layout.restoreX ?? x;
            nextRestoreY = layout.restoreY ?? y;
            nextRestoreW = layout.restoreW ?? w;
            nextRestoreH = layout.restoreH ?? h;
          }
        }

        const el = workspaceRef.current;
        if (!el) return;
        const ws = el.getBoundingClientRect();

        const minLimitY = ws.top + TOPBAR_H + PADDING;
        const maxLimitY = ws.top + ws.height - FOOTER_H - PADDING - TITLEBAR_H;

        const nx = Math.max(
          ws.left + PADDING,
          Math.min(
            dr.startPanelX + dx,
            ws.left + ws.width - currentW - PADDING,
          ),
        );
        const ny = Math.max(
          minLimitY,
          Math.min(dr.startPanelY + dy, maxLimitY),
        );

        // If we just started dragging a docked panel, immediately undock it so other windows push in in real time!
        if (dr.started && localIsDockedRef.current) {
          localIsDockedRef.current = false;
          undockTimeRef.current = Date.now();
          onLayoutChange({
            ...layout,
            isDocked: false,
            zone: "free",
            x: nx,
            y: ny,
          });
          return;
        }

        // Track if mouse has left the original panel bounds
        if (originalPanelRectRef.current && !hasLeftOriginalZoneRef.current) {
          const rect = originalPanelRectRef.current;
          const buffer = 15; // px buffer
          const isOutside =
            me.clientX < rect.left - buffer ||
            me.clientX > rect.right + buffer ||
            me.clientY < rect.top - buffer ||
            me.clientY > rect.bottom + buffer;

          if (isOutside) {
            hasLeftOriginalZoneRef.current = true;
          }
        }

        // 1. Detect snapping to other docked panels
        const otherEls = Array.from(
          document.querySelectorAll(".floating-panel.fip--docked"),
        ).filter((node) => node.getAttribute("data-panel-id") !== id);

        let targetSnap: {
          zone: SnapZone;
          dockColumn: number;
          dockRow: number;
          x: number;
          y: number;
          w: number;
          h: number;
          maximized?: boolean;
        } | null = null;

        const isUndockLocked =
          originalZoneRef.current !== null &&
          !hasLeftOriginalZoneRef.current &&
          undockTimeRef.current !== null &&
          Date.now() - undockTimeRef.current < 800;

        if (!isUndockLocked) {
          // Find if cursor is close to/hovering any docked panel B
          const hoverThreshold = 40; // px around B to trigger snapping
          for (const node of otherEls) {
            const B = node.getBoundingClientRect();
            const otherZone = node.getAttribute("data-dock-zone") as SnapZone;
            const otherColumn = parseFloat(
              node.getAttribute("data-dock-column") || "0",
            );
            const otherRow = parseFloat(
              node.getAttribute("data-dock-row") || "0",
            );

            // Check if cursor is within B (including the hover threshold)
            const inHorizontal =
              me.clientX >= B.left - hoverThreshold &&
              me.clientX <= B.right + hoverThreshold;
            const inVertical =
              me.clientY >= B.top - hoverThreshold &&
              me.clientY <= B.bottom + hoverThreshold;

            if (inHorizontal && inVertical) {
              // Cursor is hovering over or near B. Determine closest edge.
              const distLeft = Math.abs(me.clientX - B.left);
              const distRight = Math.abs(me.clientX - B.right);
              const distTop = Math.abs(me.clientY - B.top);
              const distBottom = Math.abs(me.clientY - B.bottom);

              const minDist = Math.min(
                distLeft,
                distRight,
                distTop,
                distBottom,
              );
              if (minDist <= hoverThreshold) {
                if (minDist === distLeft) {
                  targetSnap = {
                    zone: otherZone,
                    dockColumn: otherColumn - 0.5,
                    dockRow: 0,
                    x: B.left,
                    y: B.top,
                    w: B.width / 2,
                    h: B.height,
                  };
                } else if (minDist === distRight) {
                  targetSnap = {
                    zone: otherZone,
                    dockColumn: otherColumn + 0.5,
                    dockRow: 0,
                    x: B.left + B.width / 2,
                    y: B.top,
                    w: B.width / 2,
                    h: B.height,
                  };
                } else if (minDist === distTop) {
                  targetSnap = {
                    zone: otherZone,
                    dockColumn: otherColumn,
                    dockRow: otherRow - 0.5,
                    x: B.left,
                    y: B.top,
                    w: B.width,
                    h: B.height / 2,
                  };
                } else {
                  targetSnap = {
                    zone: otherZone,
                    dockColumn: otherColumn,
                    dockRow: otherRow + 0.5,
                    x: B.left,
                    y: B.top + B.height / 2,
                    w: B.width,
                    h: B.height / 2,
                  };
                }
                break; // Found snap target
              }
            }
          }

          // 2. If no panel snap, check edge snap
          if (!targetSnap) {
            if (me.clientY < ws.top + 20) {
              targetSnap = {
                zone: "free",
                dockColumn: 0,
                dockRow: 0,
                x: ws.left + PADDING,
                y: ws.top + TOPBAR_H + PADDING,
                w: ws.width - PADDING * 2,
                h: ws.height - TOPBAR_H - FOOTER_H - PADDING * 2,
                maximized: true,
              };
            } else {
              const detected = detectZone(me.clientX, me.clientY, ws);
              if (detected) {
                const snap = calcSnap(
                  id,
                  detected,
                  ws,
                  nx,
                  ny,
                  currentW,
                  currentH,
                );
                targetSnap = {
                  zone: detected,
                  dockColumn: 0,
                  dockRow: 0,
                  ...snap,
                };
              }
            }
          }

          // Apply original-zone snap filtering to prevent flicker before leaving the zone
          if (
            targetSnap &&
            originalZoneRef.current &&
            !hasLeftOriginalZoneRef.current
          ) {
            if (targetSnap.zone === originalZoneRef.current) {
              const isSameSlot =
                targetSnap.dockColumn === originalDockColumnRef.current &&
                targetSnap.dockRow === originalDockRowRef.current;
              const isEdgeSnap = !otherEls.some(
                (node) =>
                  node.getAttribute("data-dock-zone") ===
                  originalZoneRef.current,
              );
              if (isSameSlot || isEdgeSnap) {
                targetSnap = null;
              }
            }
          }
        }

        lastSnapRef.current = targetSnap;
        const curLayout = layoutRef.current;

        if (targetSnap) {
          const hasChanged =
            curLayout.isDocked !== !targetSnap.maximized ||
            curLayout.zone !== targetSnap.zone ||
            curLayout.dockColumn !== targetSnap.dockColumn ||
            curLayout.dockRow !== targetSnap.dockRow ||
            curLayout.maximized !== (targetSnap.maximized ?? false);

          if (hasChanged) {
            const isSameAsPending =
              pendingSnapRef.current &&
              pendingSnapRef.current.zone === targetSnap.zone &&
              pendingSnapRef.current.dockColumn === targetSnap.dockColumn &&
              pendingSnapRef.current.dockRow === targetSnap.dockRow &&
              pendingSnapRef.current.maximized === targetSnap.maximized;

            if (!isSameAsPending) {
              if (snapTimerRef.current) {
                clearTimeout(snapTimerRef.current);
              }
              pendingSnapRef.current = targetSnap;
              snapTimerRef.current = setTimeout(() => {
                const latestLayout = layoutRef.current;
                onLayoutChange({
                  ...latestLayout,
                  isDocked: !targetSnap.maximized,
                  maximized: targetSnap.maximized ?? false,
                  zone: targetSnap.zone,
                  dockColumn: targetSnap.dockColumn,
                  dockRow: targetSnap.dockRow,
                  restoreX: targetSnap.maximized
                    ? latestLayout.maximized
                      ? (latestLayout.restoreX ?? x)
                      : x
                    : latestLayout.restoreX,
                  restoreY: targetSnap.maximized
                    ? latestLayout.maximized
                      ? (latestLayout.restoreY ?? y)
                      : y
                    : latestLayout.restoreY,
                  restoreW: targetSnap.maximized
                    ? latestLayout.maximized
                      ? (latestLayout.restoreW ?? w)
                      : w
                    : latestLayout.restoreW,
                  restoreH: targetSnap.maximized
                    ? latestLayout.maximized
                      ? (latestLayout.restoreH ?? h)
                      : h
                    : latestLayout.restoreH,
                });
                pendingSnapRef.current = null;
                snapTimerRef.current = null;
              }, SNAP_DELAY);
            }
          } else {
            if (snapTimerRef.current) {
              clearTimeout(snapTimerRef.current);
              snapTimerRef.current = null;
            }
            pendingSnapRef.current = null;
          }
        } else {
          if (snapTimerRef.current) {
            clearTimeout(snapTimerRef.current);
            snapTimerRef.current = null;
          }
          pendingSnapRef.current = null;
        }

        const isCurrentlySnappedToTarget =
          targetSnap &&
          curLayout.isDocked === !targetSnap.maximized &&
          curLayout.zone === targetSnap.zone &&
          curLayout.dockColumn === targetSnap.dockColumn &&
          curLayout.dockRow === targetSnap.dockRow &&
          curLayout.maximized === (targetSnap.maximized ?? false);

        if (!isCurrentlySnappedToTarget) {
          const hasChanged =
            curLayout.isDocked !== false ||
            curLayout.zone !== "free" ||
            curLayout.maximized !== false ||
            curLayout.x !== nx ||
            curLayout.y !== ny ||
            curLayout.w !== currentW ||
            curLayout.h !== currentH;

          if (hasChanged) {
            onLayoutChange({
              ...curLayout,
              isDocked: false,
              maximized: localMaximized,
              restoreX: nextRestoreX,
              restoreY: nextRestoreY,
              restoreW: nextRestoreW,
              restoreH: nextRestoreH,
              zone: "free",
              x: nx,
              y: ny,
              w: currentW,
              h: currentH,
            });
          }
        }
      }

      function onUp() {
        if (snapTimerRef.current) {
          clearTimeout(snapTimerRef.current);
          snapTimerRef.current = null;
        }
        pendingSnapRef.current = null;

        dragRef.current = null;
        setCaptureCursor(null);
        document.body.classList.remove("fip-active-operation");
        document.body.classList.remove("fip-dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // If we released before leaving the original zone boundary, snap back to the original layout position
        const latestLayout = layoutRef.current;
        if (originalZoneRef.current && !hasLeftOriginalZoneRef.current) {
          onLayoutChange({
            ...latestLayout,
            isDocked: true,
            zone: originalZoneRef.current,
            dockColumn: originalDockColumnRef.current,
            dockRow: originalDockRowRef.current,
          });
        }

        lastSnapRef.current = null;

        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("blur", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("blur", onUp);
    },
    [x, y, w, h, id, layout, onLayoutChange, detectZone, workspaceRef],
  );

  // ── Resize handlers ────────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, edge: string) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = panelRef.current?.getBoundingClientRect();
      const panelX = rect ? rect.left : x;
      const panelY = rect ? rect.top : y;

      resizeRef.current = {
        edge,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startW: w,
        startH: h,
        startX: panelX,
        startY: panelY,
        started: false,
      };

      const cursor = EDGE_CURSORS[edge] ?? "default";
      setCaptureCursor(cursor);
      document.body.classList.add("fip-active-operation");
      document.body.classList.add("fip-resizing");
      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";

      function onMove(me: MouseEvent) {
        const r = resizeRef.current;
        if (!r) return;

        const rawDx = me.clientX - r.startMouseX;
        const rawDy = me.clientY - r.startMouseY;

        if (!r.started) {
          if (
            Math.abs(rawDx) < DRAG_THRESHOLD &&
            Math.abs(rawDy) < DRAG_THRESHOLD
          )
            return;
          r.started = true;
        }

        const el = workspaceRef.current;
        const ws = el?.getBoundingClientRect();

        let nw = r.startW,
          nh = r.startH,
          nx = r.startX,
          ny = r.startY;

        if (ws) {
          if (edge.includes("w")) {
            // Left edge is being dragged. Right edge is fixed at r.startX + r.startW
            const fixedRight = r.startX + r.startW;
            const rawNx = r.startX + rawDx;
            nx = Math.max(
              ws.left + PADDING,
              Math.min(rawNx, fixedRight - minWidth),
            );
            nw = fixedRight - nx;
          } else if (edge.includes("e")) {
            // Right edge is being dragged. Left edge is fixed at r.startX
            const rawNw = r.startW + rawDx;
            nw = Math.max(
              minWidth,
              Math.min(rawNw, ws.left + ws.width - PADDING - nx),
            );
          }

          if (edge.includes("n")) {
            // Top edge is being dragged. Bottom edge is fixed at r.startY + r.startH
            const fixedBottom = r.startY + r.startH;
            const rawNy = r.startY + rawDy;
            ny = Math.max(
              ws.top + TOPBAR_H + PADDING,
              Math.min(rawNy, fixedBottom - minHeight),
            );
            nh = fixedBottom - ny;
          } else if (edge.includes("s")) {
            // Bottom edge is being dragged. Top edge is fixed at r.startY
            const rawNh = r.startH + rawDy;
            nh = Math.max(minHeight, Math.min(rawNh, window.innerHeight - ny));
          }
        } else {
          if (edge.includes("e")) nw = Math.max(minWidth, r.startW + rawDx);
          if (edge.includes("s")) nh = Math.max(minHeight, r.startH + rawDy);
          if (edge.includes("w")) {
            nw = Math.max(minWidth, r.startW - rawDx);
            nx = r.startX + (r.startW - nw);
          }
          if (edge.includes("n")) {
            nh = Math.max(minHeight, r.startH - rawDy);
            ny = r.startY + (r.startH - nh);
          }
        }

        onLayoutChange({
          ...layout,
          w: nw,
          h: nh,
          x: nx,
          y: ny,
        });
      }

      function onUp() {
        resizeRef.current = null;
        setCaptureCursor(null);
        document.body.classList.remove("fip-active-operation");
        document.body.classList.remove("fip-resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("blur", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("blur", onUp);
    },
    [x, y, w, h, minWidth, minHeight, layout, onLayoutChange, workspaceRef],
  );

  const handleTitlebarDoubleClick = useCallback(() => {
    if (isDocked) return;
    if (layout.maximized) {
      onLayoutChange({
        ...layout,
        maximized: false,
        x: layout.restoreX ?? x,
        y: layout.restoreY ?? y,
        w: layout.restoreW ?? w,
        h: layout.restoreH ?? h,
      });
    } else {
      onLayoutChange({
        ...layout,
        maximized: true,
        restoreX: x,
        restoreY: y,
        restoreW: w,
        restoreH: h,
      });
    }
  }, [isDocked, layout, onLayoutChange, x, y, w, h]);

  if (!visible) return null;

  const isBottomDocked = isDocked && zone === "dock-bottom";

  const renderTitleBar = () => {
    if (isBottomDocked) {
      return (
        <div
          className="fip-titlebar fip-titlebar--vertical"
          onMouseDown={handleTitlebarMouseDown}
          onDoubleClick={handleTitlebarDoubleClick}
          style={{
            display: "flex",
            flexDirection: "column",
            width: "32px",
            height: "100%",
            borderBottom: "none",
            borderRight: "1px solid var(--border-medium)",
            padding: "8px 4px",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0, 0, 0, 0.12)",
            flexShrink: 0,
            cursor: "grab",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              width: "100%",
            }}
          >
            <GripVertical
              size={11}
              className="fip-grip"
              style={{
                transform: "rotate(90deg)",
                opacity: 0.6,
                cursor: "grab",
              }}
            />
            <span
              className="fip-title"
              style={{
                writingMode: "vertical-lr",
                transform: "rotate(180deg)",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-1)",
                userSelect: "none",
                marginTop: "12px",
              }}
            >
              {title}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              width: "100%",
              marginTop: "auto",
            }}
          >
            <button
              type="button"
              className="fip-action-btn"
              onClick={() =>
                onLayoutChange({ ...layout, minimized: !minimized })
              }
              title={minimized ? "Expand" : "Minimize"}
              style={{
                width: "22px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              {minimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
            </button>
            <button
              type="button"
              className="fip-action-btn fip-action-btn--close"
              onClick={() => onLayoutChange({ ...layout, visible: false })}
              title="Close"
              style={{
                width: "22px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <X size={10} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="fip-titlebar"
        onMouseDown={handleTitlebarMouseDown}
        onDoubleClick={handleTitlebarDoubleClick}
      >
        <div className="fip-titlebar-left">
          <GripVertical size={11} className="fip-grip" />
          <span className="fip-title">{title}</span>
        </div>
        {titleActions && (
          <div className="fip-titlebar-middle">{titleActions}</div>
        )}
        <div className="fip-titlebar-actions">
          <button
            type="button"
            className="fip-action-btn"
            onClick={() => onLayoutChange({ ...layout, minimized: !minimized })}
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
          </button>
          <button
            type="button"
            className="fip-action-btn fip-action-btn--close"
            onClick={() => onLayoutChange({ ...layout, visible: false })}
            title="Close"
          >
            <X size={10} />
          </button>
        </div>
      </div>
    );
  };

  const transitionStyle = captureCursor
    ? "none"
    : "left 0.2s cubic-bezier(0.16, 1, 0.3, 1), top 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s cubic-bezier(0.16, 1, 0.3, 1)";

  const panelStyle: React.CSSProperties = isDocked
    ? dockedRect
      ? {
          position: "fixed",
          left: dockedRect.left,
          top: dockedRect.top,
          width: dockedRect.width,
          height: dockedRect.height,
          zIndex: 900,
          transition: transitionStyle,
        }
      : {
          position: "fixed",
          left: x,
          top: y,
          width: w,
          height: minimized ? "auto" : h,
          zIndex: 900,
          transition: transitionStyle,
        }
    : layout.maximized
      ? {
          position: "fixed",
          left: PADDING,
          top: TOPBAR_H + PADDING,
          width: window.innerWidth - PADDING * 2,
          height: minimized
            ? "auto"
            : window.innerHeight -
              TOPBAR_H -
              FOOTER_H -
              PADDING * 2 -
              reservedBottomSpace,
          zIndex: 900,
          transition: transitionStyle,
        }
      : {
          position: "fixed",
          left: x,
          top: y,
          width: w,
          height: minimized ? "auto" : h,
          zIndex: 900,
          transition: transitionStyle,
        };

  const renderResizeHandles = () => {
    if (layout.maximized) return null;
    if (isDocked) {
      const handles = [];
      // Column width horizontal resizer
      if (zone === "dock-left") {
        handles.push(
          <div
            key="e"
            className="fip-resize fip-resize--e"
            onMouseDown={(e) => handleResizeMouseDown(e, "e")}
          />,
        );
      } else if (zone === "dock-right") {
        handles.push(
          <div
            key="w"
            className="fip-resize fip-resize--w"
            onMouseDown={(e) => handleResizeMouseDown(e, "w")}
          />,
        );
      }

      // Stack height/width vertical/horizontal resizer
      if (!isOnlyInColumn && !isLastInColumn) {
        handles.push(
          <div
            key="s"
            className="fip-resize fip-resize--s"
            onMouseDown={(e) => handleResizeMouseDown(e, "s")}
            style={{
              bottom: 0,
              height: 4,
              cursor: "row-resize",
              width: "100%",
              left: 0,
            }}
          />,
        );
      }
      return <>{handles}</>;
    }

    if (minimized) return null;

    // Free-floating panel resizer handles (all 8 directions)
    return (
      <>
        <div
          className="fip-resize fip-resize--n"
          onMouseDown={(e) => handleResizeMouseDown(e, "n")}
        />
        <div
          className="fip-resize fip-resize--s"
          onMouseDown={(e) => handleResizeMouseDown(e, "s")}
        />
        <div
          className="fip-resize fip-resize--e"
          onMouseDown={(e) => handleResizeMouseDown(e, "e")}
        />
        <div
          className="fip-resize fip-resize--w"
          onMouseDown={(e) => handleResizeMouseDown(e, "w")}
        />
        <div
          className="fip-resize fip-resize--nw"
          onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
        />
        <div
          className="fip-resize fip-resize--ne"
          onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
        />
        <div
          className="fip-resize fip-resize--sw"
          onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
        />
        <div
          className="fip-resize fip-resize--se"
          onMouseDown={(e) => handleResizeMouseDown(e, "se")}
        />
      </>
    );
  };

  const panelClassName = `fip floating-panel ${
    isDocked ? `fip--docked fip--docked-${zone}` : "fip--free"
  } ${minimized ? "fip--minimized" : ""} ${id === "sidebar" ? "sidebar" : ""} ${id === "inspector" ? "inspector" : ""} ${id === "info-panel" ? "selection-popover" : ""}`;

  return (
    <>
      {captureCursor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            cursor: captureCursor,
            background: "transparent",
          }}
        />
      )}

      <div
        ref={panelRef}
        className={panelClassName}
        style={{
          ...panelStyle,
          display: "flex",
          flexDirection: isBottomDocked ? "row" : "column",
        }}
        data-panel-id={id}
        data-dock-zone={zone}
        data-dock-column={layout.dockColumn ?? 0}
        data-dock-row={layout.dockRow ?? 0}
      >
        {renderResizeHandles()}
        {renderTitleBar()}
        {!minimized && (
          <div
            className="fip-body"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: isBottomDocked ? "row" : "column",
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </>
  );
}

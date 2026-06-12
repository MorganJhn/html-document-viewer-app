import React from "react";
import { Copy } from "lucide-react";
import type { SelectionItem } from "../types";
import { FloatingPanel, type PanelLayout } from "./FloatingPanel";
import { HorizontalScrollContainer } from "./ui";

interface FloatingInfoPanelProps {
  items: SelectionItem[];
  onCopyAll: () => void;
  onCopyItem: (ref: string) => void;
  copyNotice: string;
  workspaceRef: React.RefObject<HTMLElement | null>;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  isOnlyInColumn?: boolean;
  isLastInColumn?: boolean;
  reservedBottomSpace?: number;
  allowBottomDock?: boolean;
}

export function FloatingInfoPanel({
  items,
  onCopyAll,
  onCopyItem,
  copyNotice,
  workspaceRef,
  layout,
  onLayoutChange,
  isOnlyInColumn = true,
  isLastInColumn = false,
  reservedBottomSpace = 0,
  allowBottomDock = true,
}: FloatingInfoPanelProps) {
  if (!layout.visible) return null;

  const title =
    items.length === 1 ? items[0].label : `${items.length} components`;

  const titleActions = (
    <button
      type="button"
      className="fip-action-btn"
      onClick={onCopyAll}
      title="Copy all references"
    >
      <Copy size={10} />
    </button>
  );

  const isBottom = layout.isDocked && layout.zone === "dock-bottom";

  const renderContent = () => {
    const listContent = (
      <div
        className="fip-list"
        style={
          isBottom
            ? {
                display: "flex",
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
                padding: "0 4px",
              }
            : undefined
        }
      >
        {items.map((item) => (
          <button
            key={item.path}
            type="button"
            className="fip-item"
            onClick={() => onCopyItem(item.agentReference)}
            title={item.agentReference}
            style={
              isBottom
                ? {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    width: "auto",
                    flexShrink: 0,
                    height: 28,
                    padding: "4px 10px",
                  }
                : undefined
            }
          >
            <div
              className="fip-item-top"
              style={isBottom ? { gap: 6 } : undefined}
            >
              <span className="fip-item-tag">{item.tag}</span>
              <strong
                className="fip-item-label"
                style={
                  isBottom
                    ? {
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        flex: "none",
                        maxWidth: 120,
                      }
                    : undefined
                }
              >
                {item.label}
              </strong>
            </div>
            <code
              className="fip-item-ref"
              style={isBottom ? { margin: 0, padding: 0 } : undefined}
            >
              {item.agentReference}
            </code>
          </button>
        ))}
      </div>
    );

    if (isBottom) {
      return (
        <HorizontalScrollContainer
          style={{ height: 48, flex: 1 }}
          navigation="scrollbar"
        >
          {listContent}
        </HorizontalScrollContainer>
      );
    }

    return listContent;
  };

  return (
    <FloatingPanel
      id="info-panel"
      title={title}
      titleActions={titleActions}
      layout={layout}
      onLayoutChange={onLayoutChange}
      allowedZones={["free", "dock-left", "dock-right", "dock-bottom"]}
      workspaceRef={workspaceRef}
      minWidth={220}
      minHeight={100}
      isOnlyInColumn={isOnlyInColumn}
      isLastInColumn={isLastInColumn}
      reservedBottomSpace={reservedBottomSpace}
      allowBottomDock={allowBottomDock}
    >
      {renderContent()}

      {copyNotice && (
        <div className="fip-copy-notice">
          <Copy size={10} />
          {copyNotice}
        </div>
      )}

      {layout.isDocked && (
        <div
          className="fip-zone-badge"
          style={isBottom ? { marginTop: 4 } : undefined}
        >
          {layout.zone === "dock-left" && "← Left dock"}
          {layout.zone === "dock-right" && "Right dock →"}
          {layout.zone === "dock-bottom" && "↓ Bottom dock"}
          {" · drag to undock"}
        </div>
      )}
    </FloatingPanel>
  );
}

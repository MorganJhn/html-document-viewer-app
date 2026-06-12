import React from 'react'
import { Copy } from 'lucide-react'
import type { SelectionItem } from '../types'
import { FloatingPanel, type PanelLayout } from './FloatingPanel'

interface FloatingInfoPanelProps {
  items: SelectionItem[]
  onCopyAll: () => void
  onCopyItem: (ref: string) => void
  copyNotice: string
  workspaceRef: React.RefObject<HTMLElement | null>
  layout: PanelLayout
  onLayoutChange: (layout: PanelLayout) => void
  isOnlyInColumn?: boolean
  isLastInColumn?: boolean
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
}: FloatingInfoPanelProps) {
  if (!layout.visible) return null

  const title = items.length === 1 ? items[0].label : `${items.length} components`

  const titleActions = (
    <button
      type="button"
      className="fip-action-btn"
      onClick={onCopyAll}
      title="Copy all references"
    >
      <Copy size={10} />
    </button>
  )

  return (
    <FloatingPanel
      id="info-panel"
      title={title}
      titleActions={titleActions}
      layout={layout}
      onLayoutChange={onLayoutChange}
      allowedZones={['free', 'dock-left', 'dock-right', 'dock-bottom']}
      workspaceRef={workspaceRef}
      minWidth={220}
      minHeight={120}
      isOnlyInColumn={isOnlyInColumn}
      isLastInColumn={isLastInColumn}
    >
      <div className="fip-list">
        {items.map((item) => (
          <button
            key={item.path}
            type="button"
            className="fip-item"
            onClick={() => onCopyItem(item.agentReference)}
            title={item.agentReference}
          >
            <div className="fip-item-top">
              <span className="fip-item-tag">{item.tag}</span>
              <strong className="fip-item-label">{item.label}</strong>
            </div>
            <code className="fip-item-ref">{item.agentReference}</code>
          </button>
        ))}
      </div>

      {copyNotice && (
        <div className="fip-copy-notice">
          <Copy size={10} />
          {copyNotice}
        </div>
      )}

      {layout.isDocked && (
        <div className="fip-zone-badge">
          {layout.zone === 'dock-left' && '← Left dock'}
          {layout.zone === 'dock-right' && 'Right dock →'}
          {layout.zone === 'dock-bottom' && '↓ Bottom dock'}
          {' · drag to undock'}
        </div>
      )}
    </FloatingPanel>
  )
}

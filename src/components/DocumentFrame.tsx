import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import type { DocumentSettings, ElementEdit, SelectionItem } from '../types'
import { buildSettingsCss } from '../lib/documentSettings'
import { cleanTemplateClone, collectSelectionItem, inlineComputedStyles, getElementLabel } from '../lib/selection'

export interface DocumentFrameHandle {
  applyElementEdit: (edit: ElementEdit) => void
  applyDocumentSettings: (settings: DocumentSettings) => void
  getSelectedHtml: (inlineStyles: boolean) => string
  refreshSelectionProperties: () => void
  getAncestors: (path: string) => Array<{ tag: string; path: string; label: string }>
  selectElementByPath: (path: string) => void
  getElementInnerHtml: (path: string) => string
  getShellElement: () => HTMLDivElement | null
}

interface DocumentFrameProps {
  documentId?: string
  documentPath?: string
  reloadToken: number
  selectorEnabled: boolean
  selectedItems: SelectionItem[]
  onSelectionChange: (items: SelectionItem[]) => void
  onFrameContextMenu?: (x: number, y: number, path: string) => void
  onElementEdit?: (edit: Omit<ElementEdit, 'targetPath'>) => void
  shellClassName?: string
}

export const DocumentFrame = forwardRef<DocumentFrameHandle, DocumentFrameProps>(function DocumentFrame(
  { documentId, documentPath, reloadToken, selectorEnabled, selectedItems, onSelectionChange, onFrameContextMenu, onElementEdit, shellClassName },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const selectorEnabledRef = useRef(selectorEnabled)
  const selectedPathsRef = useRef<string[]>([])
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onFrameContextMenuRef = useRef(onFrameContextMenu)
  const dragStateRef = useRef<{ x: number; y: number; active: boolean } | null>(null)
  const lastDragSelectionRef = useRef(false)
  const [pageTurn, setPageTurn] = useState(false)

  useEffect(() => {
    if (!documentId) return
    setPageTurn(true)
    const timer = setTimeout(() => {
      setPageTurn(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [documentId, reloadToken])

  useEffect(() => {
    selectorEnabledRef.current = selectorEnabled
    setFrameSelectorCursor(selectorEnabled)
  }, [selectorEnabled])

  useEffect(() => {
    onFrameContextMenuRef.current = onFrameContextMenu
  }, [onFrameContextMenu])

  useEffect(() => {
    selectedPathsRef.current = selectedItems.map((item) => item.path)
    updateSelectionClasses()
  }, [selectedItems])

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  useImperativeHandle(ref, () => ({
    applyElementEdit(edit) {
      const doc = iframeRef.current?.contentDocument
      if (!doc) {
        return
      }
      for (const element of findAllByPath(doc, edit.targetPath)) {
        const htmlElement = element as HTMLElement
        if (edit.styles) {
          for (const [name, value] of Object.entries(edit.styles)) {
            htmlElement.style.setProperty(name, value || '')
          }
        }
        if (edit.attributes) {
          for (const [name, value] of Object.entries(edit.attributes)) {
            if (value === null) {
              element.removeAttribute(name)
            } else {
              element.setAttribute(name, value)
            }
          }
        }
        if (typeof edit.textContent === 'string') {
          element.textContent = edit.textContent
        }
      }
      refreshSelectionProperties()
    },
    applyDocumentSettings(settings) {
      const doc = iframeRef.current?.contentDocument
      if (!doc) {
        return
      }
      let style = doc.querySelector('style[data-hdv-preview-settings]')
      if (!style) {
        style = doc.createElement('style')
        style.setAttribute('data-hdv-preview-settings', '')
        doc.head.append(style)
      }
      style.textContent = buildSettingsCss(settings)
    },
    getSelectedHtml(inlineStyles) {
      const iframeWindow = iframeRef.current?.contentWindow
      const doc = iframeRef.current?.contentDocument
      if (!iframeWindow || !doc) {
        return ''
      }
      return selectedPathsRef.current
        .map((path) => doc.querySelector(pathSelector(path)))
        .filter((element): element is Element => Boolean(element))
        .map((element) => {
          const clone = cleanTemplateClone(element)
          if (inlineStyles) {
            inlineComputedStyles(element, clone, iframeWindow)
          }
          return clone.outerHTML
        })
        .join('\n')
    },
    refreshSelectionProperties,
    getAncestors(path) {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return []
      const element = doc.querySelector(pathSelector(path))
      if (!element) return []
      
      const ancestors: Array<{ tag: string; path: string; label: string }> = []
      let current: Element | null = element
      while (current && current.tagName && current.tagName.toLowerCase() !== 'html') {
        const hdvPath = current.getAttribute('data-hdv-path') || ''
        ancestors.unshift({
          tag: current.tagName.toLowerCase(),
          path: hdvPath,
          label: getElementLabel(current)
        })
        current = current.parentElement
      }
      return ancestors
    },
    selectElementByPath(path) {
      const doc = iframeRef.current?.contentDocument
      const iframeWindow = iframeRef.current?.contentWindow
      if (!doc || !iframeWindow) return
      const element = doc.querySelector(pathSelector(path))
      if (!element) return
      
      const item = collectSelectionItem(element, iframeWindow)
      onSelectionChangeRef.current([item])
    },
    getElementInnerHtml(path) {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return ''
      const element = doc.querySelector(pathSelector(path))
      return element ? element.innerHTML : ''
    },
    getShellElement() {
      return shellRef.current
    },
  }))

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !documentId) {
      return
    }

    const onLoad = () => attachFrameListeners()
    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') {
      attachFrameListeners()
    }
    const interval = window.setInterval(() => {
      const doc = iframe.contentDocument
      if (doc?.querySelector('[data-hdv-path]')) {
        attachFrameListeners()
        window.clearInterval(interval)
      }
    }, 100)
    return () => {
      iframe.removeEventListener('load', onLoad)
      window.clearInterval(interval)
    }
    // Listener attachment is tied to iframe reloads; mutable refs carry the latest callbacks and mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, reloadToken])

  function attachFrameListeners() {
    const doc = iframeRef.current?.contentDocument
    if (!doc) {
      return
    }
    const attachedDocument = doc as Document & { hdvListenersAttached?: boolean }
    if (attachedDocument.hdvListenersAttached) {
      return
    }
    attachedDocument.hdvListenersAttached = true

    doc.addEventListener('mousemove', handleIframeMouseMove)
    doc.addEventListener('mousedown', handleMouseDown)
    doc.addEventListener('mousedown', () => {
      window.parent.dispatchEvent(new CustomEvent('hdv-iframe-mousedown'))
    })
    doc.addEventListener('mouseup', handleMouseUp)
    doc.addEventListener('click', handleClick, true)
    doc.addEventListener('mouseleave', clearHover)
    doc.addEventListener('contextmenu', handleContextMenu)
    setFrameSelectorCursor(selectorEnabledRef.current)
    updateSelectionClasses()
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault()
    const iframeRect = iframeRef.current?.getBoundingClientRect()
    if (!iframeRect || !onFrameContextMenuRef.current) return

    if (!selectorEnabledRef.current) {
      onFrameContextMenuRef.current(
        iframeRect.left + event.clientX,
        iframeRect.top + event.clientY,
        '__canvas__'
      )
      return
    }

    const target = selectableFromEvent(event)
    const path = target?.getAttribute('data-hdv-path')
    if (path) {
      onFrameContextMenuRef.current(
        iframeRect.left + event.clientX,
        iframeRect.top + event.clientY,
        path
      )
    } else {
      onFrameContextMenuRef.current(
        iframeRect.left + event.clientX,
        iframeRect.top + event.clientY,
        '__canvas__'
      )
    }
  }

  function handleIframeMouseMove(event: MouseEvent) {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !selectorEnabledRef.current) {
      return
    }

    const hovered = selectableFromEvent(event)
    doc.querySelectorAll('.hdv-hover').forEach((node) => node.classList.remove('hdv-hover'))
    hovered?.classList.add('hdv-hover')

    const drag = dragStateRef.current
    if (drag) {
      const width = event.clientX - drag.x
      const height = event.clientY - drag.y
      if (Math.abs(width) > 4 || Math.abs(height) > 4) {
        drag.active = true
        drawDragBox(doc, drag.x, drag.y, event.clientX, event.clientY)
      }
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (!selectorEnabledRef.current || event.button !== 0) {
      return
    }
    event.preventDefault()
    dragStateRef.current = { x: event.clientX, y: event.clientY, active: false }
  }

  function handleMouseUp(event: MouseEvent) {
    const doc = iframeRef.current?.contentDocument
    const frameWindow = iframeRef.current?.contentWindow
    const drag = dragStateRef.current
    if (!doc || !frameWindow || !selectorEnabledRef.current || !drag || event.button !== 0) {
      dragStateRef.current = null
      return
    }

    event.preventDefault()
    removeDragBox(doc)

    if (drag.active) {
      lastDragSelectionRef.current = true
      const rect = normalizeRect(drag.x, drag.y, event.clientX, event.clientY)
      const paths = Array.from(doc.querySelectorAll('[data-hdv-path]'))
        .filter((element) => intersects(rect, element.getBoundingClientRect()))
        .map((element) => element.getAttribute('data-hdv-path') || '')
        .filter(Boolean)
      commitSelection(paths, event)
    } else {
      lastDragSelectionRef.current = false
      const target = selectableFromEvent(event)
      const path = target?.getAttribute('data-hdv-path')
      if (path) {
        commitSelection([path], event)
      }
    }

    dragStateRef.current = null
  }

  function handleClick(event: MouseEvent) {
    if (!selectorEnabledRef.current || event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (lastDragSelectionRef.current) {
      lastDragSelectionRef.current = false
      return
    }
    const target = selectableFromEvent(event)
    const path = target?.getAttribute('data-hdv-path')
    if (path) {
      commitSelection([path], event)
    }
  }

  function commitSelection(paths: string[], event: MouseEvent) {
    const doc = iframeRef.current?.contentDocument
    const frameWindow = iframeRef.current?.contentWindow
    if (!doc || !frameWindow) {
      return
    }


    let nextPaths = unique(paths)
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const existing = new Set(selectedPathsRef.current)
      for (const path of paths) {
        if (event.ctrlKey || event.metaKey) {
          if (existing.has(path)) {
            existing.delete(path)
          } else {
            existing.add(path)
          }
        } else {
          existing.add(path)
        }
      }
      nextPaths = [...existing]
    }

    const items = nextPaths
      .map((path) => doc.querySelector(pathSelector(path)))
      .filter((element): element is Element => Boolean(element))
      .map((element) => collectSelectionItem(element, frameWindow))
    selectedPathsRef.current = items.map((item) => item.path)
    onSelectionChangeRef.current(items)
    updateSelectionClasses()
  }

  function refreshSelectionProperties() {
    const doc = iframeRef.current?.contentDocument
    const frameWindow = iframeRef.current?.contentWindow
    if (!doc || !frameWindow) {
      return
    }
    const items = selectedPathsRef.current
      .map((path) => doc.querySelector(pathSelector(path)))
      .filter((element): element is Element => Boolean(element))
      .map((element) => collectSelectionItem(element, frameWindow))
    onSelectionChangeRef.current(items)
  }

  function updateSelectionClasses() {
    const doc = iframeRef.current?.contentDocument
    if (!doc) {
      return
    }
    doc.querySelectorAll('.hdv-selected').forEach((node) => node.classList.remove('hdv-selected'))
    for (const path of selectedPathsRef.current) {
      findAllByPath(doc, path).forEach((element) => element.classList.add('hdv-selected'))
    }
  }

  function clearHover() {
    iframeRef.current?.contentDocument?.querySelectorAll('.hdv-hover').forEach((node) => node.classList.remove('hdv-hover'))
  }

  function setFrameSelectorCursor(enabled: boolean) {
    const doc = iframeRef.current?.contentDocument
    if (doc?.body) {
      doc.body.style.cursor = enabled ? 'crosshair' : ''
    }
  }

  async function copySelectionNames() {
    await navigator.clipboard.writeText(selectedItems.map((item) => item.agentReference).join('\n'))
  }

  const shellRef = useRef<HTMLDivElement | null>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const shell = shellRef.current
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    shell.style.setProperty('--mouse-x', `${x}px`)
    shell.style.setProperty('--mouse-y', `${y}px`)
  }

  const [floatBarCoords, setFloatBarCoords] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (selectedItems.length === 0) {
      setFloatBarCoords(null)
      return
    }

    const timer = setTimeout(() => {
      const doc = iframeRef.current?.contentDocument
      const iframe = iframeRef.current
      if (!doc || !iframe) return

      let minTop = Infinity
      let minLeft = Infinity
      let maxRight = -Infinity
      let found = false

      selectedItems.forEach((item) => {
        const el = doc.querySelector(`[data-hdv-path="${cssEscape(item.path)}"]`)
        if (el) {
          const r = el.getBoundingClientRect()
          if (r.top < minTop) minTop = r.top
          if (r.left < minLeft) minLeft = r.left
          if (r.right > maxRight) maxRight = r.right
          found = true
        }
      })

      if (found) {
        const iframeRect = iframe.getBoundingClientRect()
        const shell = shellRef.current
        if (shell) {
          const shellRect = shell.getBoundingClientRect()
          const relativeLeft = iframeRect.left - shellRect.left + minLeft + (maxRight - minLeft) / 2
          const relativeTop = iframeRect.top - shellRect.top + minTop - 45
          setFloatBarCoords({
            left: relativeLeft,
            top: relativeTop >= 10 ? relativeTop : relativeTop + 80
          })
        }
      } else {
        setFloatBarCoords(null)
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [selectedItems, reloadToken])

  return (
    <div
      ref={shellRef}
      onMouseMove={handleMouseMove}
      className={`document-frame-shell ${pageTurn ? 'page-turn' : ''} ${shellClassName || ''}`}
    >
      {documentId ? (
        <iframe
          ref={iframeRef}
          key={`${documentId}-${reloadToken}`}
          title="Document preview"
          className="document-frame"
          data-document-path={documentPath || ''}
          src={`/api/documents/${encodeURIComponent(documentId)}/render?reload=${reloadToken}`}
        />
      ) : (
        <div className="empty-canvas">
          <div className="empty-canvas-icon">
            <FileText size={28} strokeWidth={1.5} />
          </div>
          <p>Select a document from the sidebar to begin.</p>
        </div>
      )}

      {selectedItems.length > 0 && (
        /* FloatingInfoPanel is now rendered in App.tsx above the canvas */
        null
      )}
      {floatBarCoords && onElementEdit && (
        <div
          className="floating-toolbar"
          style={{ top: floatBarCoords.top, left: floatBarCoords.left }}
        >
          <button
            type="button"
            className="floating-toolbar-btn"
            title="Bold"
            onClick={() => {
              const el = iframeRef.current?.contentDocument?.querySelector(`[data-hdv-path="${cssEscape(selectedItems[0].path)}"]`) as HTMLElement
              const isBold = el?.style.fontWeight === 'bold' || el?.style.fontWeight === '700'
              onElementEdit({ styles: { 'font-weight': isBold ? 'normal' : 'bold' } })
            }}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="floating-toolbar-btn"
            title="Italic"
            onClick={() => {
              const el = iframeRef.current?.contentDocument?.querySelector(`[data-hdv-path="${cssEscape(selectedItems[0].path)}"]`) as HTMLElement
              const isItalic = el?.style.fontStyle === 'italic'
              onElementEdit({ styles: { 'font-style': isItalic ? 'normal' : 'italic' } })
            }}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className="floating-toolbar-btn"
            title="Underline"
            onClick={() => {
              const el = iframeRef.current?.contentDocument?.querySelector(`[data-hdv-path="${cssEscape(selectedItems[0].path)}"]`) as HTMLElement
              const isUnderline = el?.style.textDecoration === 'underline'
              onElementEdit({ styles: { 'text-decoration': isUnderline ? 'none' : 'underline' } })
            }}
          >
            <u>U</u>
          </button>
          <div className="floating-toolbar-divider" />
          <button
            type="button"
            className="floating-toolbar-btn"
            title="Copy Reference"
            onClick={copySelectionNames}
          >
            Copy Ref
          </button>
          <button
            type="button"
            className="floating-toolbar-btn floating-toolbar-btn--danger"
            title="Delete Element"
            onClick={() => {
              onElementEdit({ styles: { display: 'none' } })
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
})

function selectableFromEvent(event: MouseEvent) {
  const target = event.target
  if (!target || typeof (target as Element).closest !== 'function') {
    return undefined
  }
  return (target as Element).closest('[data-hdv-path]')
}

function findAllByPath(doc: Document, path: string) {
  return Array.from(doc.querySelectorAll(pathSelector(path)))
}

function pathSelector(path: string) {
  return `[data-hdv-path="${cssEscape(path)}"]`
}

function cssEscape(value: string) {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replaceAll('"', '\\"')
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function normalizeRect(startX: number, startY: number, endX: number, endY: number) {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY),
  }
}

function intersects(a: { left: number; top: number; right: number; bottom: number }, b: DOMRect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top && b.width > 0 && b.height > 0
}

function drawDragBox(doc: Document, startX: number, startY: number, endX: number, endY: number) {
  let box = doc.getElementById('hdv-drag-box')
  if (!box) {
    box = doc.createElement('div')
    box.id = 'hdv-drag-box'
    box.style.position = 'fixed'
    box.style.zIndex = '2147483647'
    box.style.pointerEvents = 'none'
    box.style.border = '1px solid #0f62fe'
    box.style.background = 'rgba(15, 98, 254, 0.12)'
    doc.body.append(box)
  }
  const rect = normalizeRect(startX, startY, endX, endY)
  box.style.left = `${rect.left}px`
  box.style.top = `${rect.top}px`
  box.style.width = `${rect.right - rect.left}px`
  box.style.height = `${rect.bottom - rect.top}px`
}

function removeDragBox(doc: Document) {
  doc.getElementById('hdv-drag-box')?.remove()
}

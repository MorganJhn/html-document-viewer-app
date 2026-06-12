import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check, FilePlus } from 'lucide-react'
import type { DocumentSettings } from '../types'

interface ButtonProps {
  children: ReactNode
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'toolbar' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
  title?: string
  onClick?: () => void
}

interface IconButtonProps {
  children: ReactNode
  title: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

interface TabsProps<T extends string> {
  value: T
  tabs: Array<{ value: T; label: ReactNode; count?: number; title?: string }>
  onChange: (value: T) => void
}

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}

export function Button({
  children,
  type = 'button',
  variant = 'secondary',
  className = '',
  disabled,
  title,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button button--${variant}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function IconButton({ children, title, active, disabled, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className={active ? 'icon-button icon-button--active' : 'icon-button'}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Tabs<T extends string>({ value, tabs, onChange }: TabsProps<T>) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.getAttribute('role') !== 'tab') return

    const tabButtons = Array.from(e.currentTarget.querySelectorAll('[role="tab"]')) as HTMLButtonElement[]
    const index = tabButtons.indexOf(target as HTMLButtonElement)
    if (index === -1) return

    let nextIndex: number
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabButtons.length
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabButtons.length) % tabButtons.length
      e.preventDefault()
    } else {
      return
    }

    tabButtons[nextIndex].focus()
    onChange(tabs[nextIndex].value)
  }

  return (
    <div className="tabs" role="tablist" onKeyDown={handleKeyDown}>
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={tab.value === value ? 0 : -1}
          key={tab.value}
          className={tab.value === value ? 'tab tab--active' : 'tab'}
          onClick={() => onChange(tab.value)}
          title={tab.title}
          aria-label={typeof tab.label === 'string' ? undefined : tab.title}
        >
          {typeof tab.label === 'string' ? <span>{tab.label}</span> : tab.label}
          {typeof tab.count === 'number' && <Badge variant="accent" className="tab-count-badge">{tab.count}</Badge>}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint, className = '' }: FieldProps) {
  return (
    <label className={`field${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

/* ============================================================
   DESIGN BLUEPRINT 100 — PREMIUM NEW COMPONENTS
   ============================================================ */

/* 1. <Badge> component (Item 87) */
interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  )
}

/* 2. <Skeleton> component (Item 88) */
interface SkeletonProps {
  variant?: 'text' | 'block' | 'avatar'
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ variant = 'block', className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton skeleton--${variant}${className ? ` ${className}` : ''}`}
      style={{ width, height }}
    />
  )
}

/* 3. <Tooltip> component (Item 81) */
interface TooltipProps {
  content: string
  shortcut?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}

export function Tooltip({ content, shortcut, position = 'top', children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number | null>(null)
  const [tooltipId] = useState(() => `tooltip-${Math.random().toString(36).substring(2, 9)}`)

  const handleMouseEnter = () => {
    timerRef.current = window.setTimeout(() => {
      setVisible(true)
    }, 250)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {visible && (
        <div id={tooltipId} role="tooltip" className={`tooltip tooltip--${position}`}>
          <span className="tooltip__content">{content}</span>
          {shortcut && <kbd className="tooltip__shortcut">{shortcut}</kbd>}
        </div>
      )}
    </div>
  )
}

/* 4. <Toggle> component (Item 86) */
interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  title?: string
}

export function Toggle({ checked, onChange, disabled, title }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-switch ${checked ? 'toggle-switch--active' : ''}`}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch__thumb" />
    </button>
  )
}

/* 5. <Slider> component (Item 85) */
interface SliderProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (val: number) => void
  disabled?: boolean
  title?: string
}

export function Slider({ min, max, step = 1, value, onChange, disabled, title }: SliderProps) {
  return (
    <div className="slider-wrapper">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        title={title}
        className="custom-slider"
      />
    </div>
  )
}

/* 6. <Toast> & <ToastContainer> & useToast (Item 83 & 40) */
export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function handleToast(e: Event) {
      const detail = (e as CustomEvent).detail
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: ToastItem = {
        id,
        message: detail.message,
        type: detail.type || 'info',
      }
      setToasts((prev) => [...prev, newToast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    }

    window.addEventListener('hdv-toast', handleToast)
    return () => window.removeEventListener('hdv-toast', handleToast)
  }, [])

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="toast__message">{t.message}</span>
        </div>
      ))}
    </div>,
    document.body
  )
}

/* 7. <Dialog> component (Item 84) */
interface DialogProps {
  isOpen: boolean
  title: string
  message: string
  type?: 'confirm' | 'alert' | 'prompt'
  promptPlaceholder?: string
  confirmText?: string
  cancelText?: string
  onConfirm: (val?: string) => void
  onCancel: () => void
}

export function Dialog({
  isOpen,
  title,
  message,
  type = 'alert',
  promptPlaceholder = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: DialogProps) {
  const [promptVal, setPromptVal] = useState('')
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  const modalRef = useRef<HTMLDivElement | null>(null)

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    setPromptVal('')
  }

  useEffect(() => {
    if (!isOpen) return

    const previousActiveElement = document.activeElement as HTMLElement

    const focusables = modalRef.current
      ? (Array.from(
          modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[])
      : []

    if (focusables.length > 0) {
      const promptInput = focusables.find((el) => el.classList.contains('modal-prompt-input'))
      if (promptInput) {
        promptInput.focus()
      } else {
        focusables[0].focus()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
        return
      }

      if (e.key === 'Tab') {
        const currentFocusables = modalRef.current
          ? (Array.from(
              modalRef.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              )
            ) as HTMLElement[])
          : []
        if (currentFocusables.length === 0) return

        const first = currentFocusables[0]
        const last = currentFocusables[currentFocusables.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus()
            e.preventDefault()
          }
        } else {
          if (document.activeElement === last) {
            first.focus()
            e.preventDefault()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement) {
        previousActiveElement.focus()
      }
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div
        ref={modalRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role={type === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <h3 id="dialog-title">{title}</h3>
        <p id="dialog-message">{message}</p>
        {type === 'prompt' && (
          <input
            type="text"
            className="modal-prompt-input"
            value={promptVal}
            placeholder={promptPlaceholder}
            onChange={(e) => setPromptVal(e.target.value)}
            autoFocus
          />
        )}
        <div className="modal-actions">
          {type !== 'alert' && (
            <button className="button button--secondary" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button
            className="button button--primary"
            onClick={() => onConfirm(type === 'prompt' ? promptVal : undefined)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* 8. <ContextMenu> component (Item 82 & 19-21) */
export interface ContextMenuItem {
  label?: string
  icon?: ReactNode
  shortcut?: string
  disabled?: boolean
  onClick?: () => void
  divider?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState({ x, y })
  const [prevX, setPrevX] = useState(x)
  const [prevY, setPrevY] = useState(y)

  if (x !== prevX || y !== prevY) {
    setPrevX(x)
    setPrevY(y)
    setCoords({ x, y })
  }

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const winW = window.innerWidth
      const winH = window.innerHeight
      let nx = x
      let ny = y

      if (x + rect.width > winW) {
        nx = winW - rect.width - 8
      }
      if (y + rect.height > winH) {
        ny = winH - rect.height - 8
      }

      setCoords({ x: Math.max(8, nx), y: Math.max(8, ny) })
    }
  }, [x, y, items])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleIframeMouseDown() {
      onClose()
    }

    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleOutside)
      window.addEventListener('keydown', handleEscape)
      window.addEventListener('hdv-iframe-mousedown', handleIframeMouseDown)
    }, 0)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('hdv-iframe-mousedown', handleIframeMouseDown)
    }
  }, [onClose])

  const menuStyle = { top: coords.y, left: coords.x }

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => {
        if (item.divider) {
          return <div key={idx} className="context-menu__divider" />
        }
        return (
          <button
            key={idx}
            type="button"
            className={`context-menu__item${item.disabled ? ' context-menu__item--disabled' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              if (item.onClick) item.onClick()
              onClose()
            }}
          >
            <span className="context-menu__item-left">
              {item.icon && <span className="context-menu__item-icon">{item.icon}</span>}
              <span className="context-menu__item-label">{item.label}</span>
            </span>
            {item.shortcut && <span className="context-menu__item-shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>,
    document.body
  )
}

const buildAgentPrompt = ({
  name,
  docType,
  pageSizePreset,
  orientation,
  width,
  height,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  instructions,
}: {
  name: string
  docType: 'document' | 'slides' | 'graphic'
  pageSizePreset: 'A4' | 'Letter' | 'Legal' | 'Slide16_9' | 'Custom'
  orientation: 'portrait' | 'landscape'
  width: string
  height: string
  marginTop: string
  marginRight: string
  marginBottom: string
  marginLeft: string
  instructions: string
}) => {
  return `You are Antigravity, an expert web developer pair programming with a user to generate a print-ready, premium semantic HTML document.
Your task is to populate/generate the content for the HTML document "${name}".

Please read the user's instructions for the document content:
---
${instructions || "No content instructions provided."}
---

### STRICT APP & DOCUMENT AUTHORING RULES:
1. **Semantic HTML & Page Containers**:
   - The document type is "${docType}".
   - Organize the layout using explicit page-sized containers: \`<section class="page" data-component="Page X" data-hdv-id="page-x">\` (e.g. \`<section class="page" data-component="Cover page" data-hdv-id="cover-page">\` for Page 1).
   - Each page must have the CSS class \`page\` and utilize pagination rules (like \`break-after: page;\` in CSS).
   - Use semantic elements for major layout structures: \`<main>\`, \`<section>\`, \`<article>\`, \`<header>\`, \`<footer>\`, \`<figure>\`, \`<table>\`, etc. Avoid nested anonymous \`<div>\` structures unless layout requires them.

2. **Component Metadata & Identification**:
   - Label EVERY meaningful layout block, section, container, or interactive card with a \`data-component\` attribute containing a clear, human-readable name (e.g., \`data-component="Findings section"\`).
   - Add a unique, lowercase, hyphen-separated \`data-hdv-id\` attribute to all important sections, blocks, or repeated elements (e.g., \`data-hdv-id="findings-section"\`).
   - Use \`data-name="..."\` for smaller inline parts (like badge labels or metric markers) when \`data-component\` is too prominent.

3. **Page Dimensions & Settings**:
   - The document settings are preset to "${pageSizePreset}" in "${orientation}" orientation (Width: ${width}, Height: ${height}) with margins: Top: ${marginTop}, Right: ${marginRight}, Bottom: ${marginBottom}, Left: ${marginLeft}.
   - Do NOT edit or remove the managed \`<style data-hdv-document-settings>\` block in the head. Place custom styling rules in a separate \`<style>\` block in the \`<head>\`.
   - Avoid hard-coded viewport units (\`vw\`/\`vh\`) in layout dimensions; use percentages or relative units (\`rem\`, \`em\`, \`mm\`, \`in\`) so print rendering matches the screen preview.

4. **Self-Contained / Relative Assets**:
   - Use relative paths (e.g. \`./images/logo.png\` or \`assets/banner.jpg\`) for all links, images, or media assets so they resolve correctly inside the workspace.

Please generate clean, fully styled, production-ready HTML code inside the \`<body>\` of the document matching these guidelines.`
}

interface NewDocumentModalProps {
  isOpen: boolean
  onCancel: () => void
  onCreate: (name: string, settings: DocumentSettings) => Promise<void>
}

export function NewDocumentModal({ isOpen, onCancel, onCreate }: NewDocumentModalProps) {
  const [name, setName] = useState('')
  const [docType, setDocType] = useState<'document' | 'slides' | 'graphic'>('document')
  const [pageSizePreset, setPageSizePreset] = useState<'A4' | 'Letter' | 'Legal' | 'Slide16_9' | 'Custom'>('A4')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [marginPreset, setMarginPreset] = useState<'normal' | 'narrow' | 'wide' | 'none' | 'custom'>('normal')

  const [width, setWidth] = useState('210mm')
  const [height, setHeight] = useState('297mm')
  const [marginTop, setMarginTop] = useState('20mm')
  const [marginRight, setMarginRight] = useState('20mm')
  const [marginBottom, setMarginBottom] = useState('20mm')
  const [marginLeft, setMarginLeft] = useState('20mm')
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [instructions, setInstructions] = useState('')

  const [step, setStep] = useState<1 | 2>(1)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const modalRef = useRef<HTMLDivElement | null>(null)

  const handlePageSizePresetChange = (preset: 'A4' | 'Letter' | 'Legal' | 'Slide16_9' | 'Custom') => {
    setPageSizePreset(preset)
    if (preset === 'A4') {
      setWidth(orientation === 'portrait' ? '210mm' : '297mm')
      setHeight(orientation === 'portrait' ? '297mm' : '210mm')
    } else if (preset === 'Letter') {
      setWidth(orientation === 'portrait' ? '8.5in' : '11in')
      setHeight(orientation === 'portrait' ? '11in' : '8.5in')
    } else if (preset === 'Legal') {
      setWidth(orientation === 'portrait' ? '8.5in' : '14in')
      setHeight(orientation === 'portrait' ? '14in' : '8.5in')
    } else if (preset === 'Slide16_9') {
      setWidth('297mm')
      setHeight('167mm')
    }
  }

  const handleOrientationChange = (orient: 'portrait' | 'landscape') => {
    setOrientation(orient)
    if (pageSizePreset === 'A4') {
      setWidth(orient === 'portrait' ? '210mm' : '297mm')
      setHeight(orient === 'portrait' ? '297mm' : '210mm')
    } else if (pageSizePreset === 'Letter') {
      setWidth(orient === 'portrait' ? '8.5in' : '11in')
      setHeight(orient === 'portrait' ? '11in' : '8.5in')
    } else if (pageSizePreset === 'Legal') {
      setWidth(orient === 'portrait' ? '8.5in' : '14in')
      setHeight(orient === 'portrait' ? '14in' : '8.5in')
    }
  }

  const handleMarginPresetChange = (preset: 'normal' | 'narrow' | 'wide' | 'none' | 'custom') => {
    setMarginPreset(preset)
    if (preset === 'normal') {
      setMarginTop('20mm')
      setMarginRight('20mm')
      setMarginBottom('20mm')
      setMarginLeft('20mm')
    } else if (preset === 'narrow') {
      setMarginTop('10mm')
      setMarginRight('10mm')
      setMarginBottom('10mm')
      setMarginLeft('10mm')
    } else if (preset === 'wide') {
      setMarginTop('30mm')
      setMarginRight('30mm')
      setMarginBottom('30mm')
      setMarginLeft('30mm')
    } else if (preset === 'none') {
      setMarginTop('0mm')
      setMarginRight('0mm')
      setMarginBottom('0mm')
      setMarginLeft('0mm')
    }
  }

  const handleDocTypeChange = (type: 'document' | 'slides' | 'graphic') => {
    setDocType(type)
    if (type === 'slides') {
      setPageSizePreset('Slide16_9')
      setWidth('297mm')
      setHeight('167mm')
      setOrientation('landscape')
      setMarginPreset('none')
      setMarginTop('0mm')
      setMarginRight('0mm')
      setMarginBottom('0mm')
      setMarginLeft('0mm')
    } else if (type === 'document') {
      setPageSizePreset('A4')
      setWidth(orientation === 'portrait' ? '210mm' : '297mm')
      setHeight(orientation === 'portrait' ? '297mm' : '210mm')
      setOrientation('portrait')
      setMarginPreset('normal')
      setMarginTop('20mm')
      setMarginRight('20mm')
      setMarginBottom('20mm')
      setMarginLeft('20mm')
    } else if (type === 'graphic') {
      setPageSizePreset('A4')
      setWidth(orientation === 'portrait' ? '210mm' : '297mm')
      setHeight(orientation === 'portrait' ? '297mm' : '210mm')
      setOrientation('portrait')
      setMarginPreset('none')
      setMarginTop('0mm')
      setMarginRight('0mm')
      setMarginBottom('0mm')
      setMarginLeft('0mm')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Please specify a filename.')
      return
    }

    setBusy(true)
    setErrorMsg('')

    try {
      const mappedPreset = pageSizePreset === 'Slide16_9' ? 'Custom' : pageSizePreset
      const settings: DocumentSettings = {
        pageSizePreset: mappedPreset as DocumentSettings['pageSizePreset'],
        orientation,
        width,
        height,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        backgroundColor,
      }

      const builtPrompt = buildAgentPrompt({
        name: name.endsWith('.html') || name.endsWith('.htm') ? name : `${name}.html`,
        docType,
        pageSizePreset,
        orientation,
        width,
        height,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        instructions,
      })

      await onCreate(name, settings)
      setGeneratedPrompt(builtPrompt)
      setStep(2)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create document.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(generatedPrompt)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => {
        console.warn('Clipboard write failed:', err)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
  }

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div
        ref={modalRef}
        className="modal-content new-doc-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 540 }}
      >
        <div className="new-doc-modal__header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <FilePlus size={20} className="status-green" />
          <h3 style={{ margin: 0 }}>New Document Prompt Builder</h3>
        </div>

        {step === 1 ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field-grid">
              <Field label="Document Name" hint="e.g. quarterly-report.html">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-document.html"
                  required
                  autoFocus
                />
              </Field>
              <Field label="Document Type">
                <select value={docType} onChange={(e) => handleDocTypeChange(e.target.value as 'document' | 'slides' | 'graphic')}>
                  <option value="document">📄 Standard Document (Report, Essay)</option>
                  <option value="slides">🖼️ Slide Presentation (Pitch Deck, Slide Deck)</option>
                  <option value="graphic">🎨 Visual Graphic (Infographic, Newsletter)</option>
                </select>
              </Field>
            </div>

            <div className="field-grid">
              <Field label="Page Size Preset">
                <select value={pageSizePreset} onChange={(e) => handlePageSizePresetChange(e.target.value as 'A4' | 'Letter' | 'Legal' | 'Slide16_9' | 'Custom')}>
                  <option value="A4">A4</option>
                  <option value="Letter">US Letter</option>
                  <option value="Legal">US Legal</option>
                  <option value="Slide16_9">Slide (16:9)</option>
                  <option value="Custom">Custom Dimensions</option>
                </select>
              </Field>
              <Field label="Orientation">
                <select value={orientation} onChange={(e) => handleOrientationChange(e.target.value as 'portrait' | 'landscape')}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </Field>
            </div>

            {pageSizePreset === 'Custom' && (
              <div className="field-grid">
                <Field label="Width">
                  <input type="text" value={width} onChange={(e) => setWidth(e.target.value)} />
                </Field>
                <Field label="Height">
                  <input type="text" value={height} onChange={(e) => setHeight(e.target.value)} />
                </Field>
              </div>
            )}

            <div className="field-grid">
              <Field label="Margins Preset">
                <select value={marginPreset} onChange={(e) => handleMarginPresetChange(e.target.value as 'normal' | 'narrow' | 'wide' | 'none' | 'custom')}>
                  <option value="normal">Normal (20mm)</option>
                  <option value="narrow">Narrow (10mm)</option>
                  <option value="wide">Wide (30mm)</option>
                  <option value="none">None (0)</option>
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <Field label="Background Color">
                <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} style={{ padding: 0, height: 28, cursor: 'pointer' }} />
              </Field>
            </div>

            {marginPreset === 'custom' && (
              <div className="field-grid field-grid--four">
                <Field label="Top">
                  <input type="text" value={marginTop} onChange={(e) => setMarginTop(e.target.value)} />
                </Field>
                <Field label="Right">
                  <input type="text" value={marginRight} onChange={(e) => setMarginRight(e.target.value)} />
                </Field>
                <Field label="Bottom">
                  <input type="text" value={marginBottom} onChange={(e) => setMarginBottom(e.target.value)} />
                </Field>
                <Field label="Left">
                  <input type="text" value={marginLeft} onChange={(e) => setMarginLeft(e.target.value)} />
                </Field>
              </div>
            )}

            <Field label="Instructions for AI Agent" hint="Describe layout, headers, content details, colors...">
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Build a 3-page business proposal for Acme Corp with sections for Introduction, Pricing Table, and Case Studies. Use a clean modern palette..."
                rows={4}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '11px', padding: '6px' }}
              />
            </Field>

            {errorMsg && (
              <div className="status-red" style={{ fontSize: '11px', marginTop: 4 }}>
                {errorMsg}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="button button--secondary" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="button button--primary" disabled={busy}>
                {busy ? 'Generating Prompt...' : 'Generate & Create Document'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="status-green" style={{ fontSize: '12px', fontWeight: 'bold' }}>
              ✓ Document created in workspace!
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-2)' }}>
              Copy the prompt below and paste it to your AI coding agent (e.g. Antigravity) to build the page structure and contents.
            </p>

            <div style={{ position: 'relative', marginTop: 6 }}>
              <textarea
                readOnly
                value={generatedPrompt}
                rows={12}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  lineHeight: '1.4',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border-3)',
                  borderRadius: 4,
                  padding: 8,
                  resize: 'none',
                }}
              />
              <button
                type="button"
                className="button button--primary"
                onClick={handleCopy}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  padding: '4px 8px',
                  minHeight: 24,
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="button button--primary" onClick={onCancel}>
                Go to Document Editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}


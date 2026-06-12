import { Palette, Ruler } from 'lucide-react'
import type { DocumentSettings } from '../types'

interface DocumentControlsProps {
  settings: DocumentSettings
  onChange: (settings: DocumentSettings) => void
  layout?: 'compact' | 'stacked'
}

export function DocumentControls({ settings, onChange, layout = 'compact' }: DocumentControlsProps) {
  function update<K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  if (layout === 'stacked') {
    return (
      <div className="document-controls document-controls--stacked">
        <label className="field">
          <span>Page size</span>
          <select
            value={settings.pageSizePreset}
            onChange={(event) => update('pageSizePreset', event.target.value as DocumentSettings['pageSizePreset'])}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="Legal">Legal</option>
            <option value="Custom">Custom</option>
          </select>
        </label>
        <label className="field">
          <span>Orientation</span>
          <select
            value={settings.orientation}
            onChange={(event) => update('orientation', event.target.value as DocumentSettings['orientation'])}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Width</span>
            <input value={settings.width} onChange={(event) => update('width', event.target.value)} />
          </label>
          <label className="field">
            <span>Height</span>
            <input value={settings.height} onChange={(event) => update('height', event.target.value)} />
          </label>
        </div>
        <div className="field-grid field-grid--four">
          <label className="field">
            <span>Top</span>
            <input value={settings.marginTop} onChange={(event) => update('marginTop', event.target.value)} />
          </label>
          <label className="field">
            <span>Right</span>
            <input value={settings.marginRight} onChange={(event) => update('marginRight', event.target.value)} />
          </label>
          <label className="field">
            <span>Bottom</span>
            <input value={settings.marginBottom} onChange={(event) => update('marginBottom', event.target.value)} />
          </label>
          <label className="field">
            <span>Left</span>
            <input value={settings.marginLeft} onChange={(event) => update('marginLeft', event.target.value)} />
          </label>
        </div>
        <label className="field color-field">
          <span>
            <Palette size={11} />
            Background color
          </span>
          <input
            type="color"
            value={toHex(settings.backgroundColor)}
            onChange={(event) => update('backgroundColor', event.target.value)}
          />
        </label>
      </div>
    )
  }

  return (
    <div className="document-controls">
      <label className="compact-field">
        <Ruler size={13} />
        <select
          value={settings.pageSizePreset}
          onChange={(event) => update('pageSizePreset', event.target.value as DocumentSettings['pageSizePreset'])}
        >
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
          <option value="Legal">Legal</option>
          <option value="Custom">Custom</option>
        </select>
      </label>
      <label className="compact-field">
        <span>Orientation</span>
        <select
          value={settings.orientation}
          onChange={(event) => update('orientation', event.target.value as DocumentSettings['orientation'])}
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      {settings.pageSizePreset === 'Custom' && (
        <>
          <label className="compact-field">
            <span>W</span>
            <input value={settings.width} onChange={(event) => update('width', event.target.value)} />
          </label>
          <label className="compact-field">
            <span>H</span>
            <input value={settings.height} onChange={(event) => update('height', event.target.value)} />
          </label>
        </>
      )}
      <label className="compact-field">
        <span>Margins</span>
        <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 2 }}>T</span>
        <input value={settings.marginTop} onChange={(event) => update('marginTop', event.target.value)} title="Top margin" style={{ width: 24, textAlign: 'center', padding: '0 2px' }} />
        <span style={{ fontSize: 9, opacity: 0.5 }}>R</span>
        <input value={settings.marginRight} onChange={(event) => update('marginRight', event.target.value)} title="Right margin" style={{ width: 24, textAlign: 'center', padding: '0 2px' }} />
        <span style={{ fontSize: 9, opacity: 0.5 }}>B</span>
        <input value={settings.marginBottom} onChange={(event) => update('marginBottom', event.target.value)} title="Bottom margin" style={{ width: 24, textAlign: 'center', padding: '0 2px' }} />
        <span style={{ fontSize: 9, opacity: 0.5 }}>L</span>
        <input value={settings.marginLeft} onChange={(event) => update('marginLeft', event.target.value)} title="Left margin" style={{ width: 24, textAlign: 'center', padding: '0 2px' }} />
      </label>
      <label className="compact-field compact-field--color">
        <Palette size={13} />
        <input
          type="color"
          value={toHex(settings.backgroundColor)}
          onChange={(event) => update('backgroundColor', event.target.value)}
        />
      </label>
    </div>
  )
}

function toHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'
}

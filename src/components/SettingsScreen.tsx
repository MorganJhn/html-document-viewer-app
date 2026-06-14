import { Field } from "./ui";

export type ThemeMode = "system" | "dark" | "light" | "true-black";
export type AccentColor = "blue" | "purple" | "teal" | "orange" | "rose";

interface SettingsScreenProps {
  accent: AccentColor;
  theme: ThemeMode;
  onAccentChange: (value: AccentColor) => void;
  onThemeChange: (value: ThemeMode) => void;
  documentCount: number;
  templateCount: number;
  onReturnToEditor: () => void;
}

export function SettingsScreen({
  accent,
  theme,
  onAccentChange,
  onThemeChange,
  documentCount,
  templateCount,
  onReturnToEditor,
}: SettingsScreenProps) {
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
                  onChange={(event) => onAccentChange(event.target.value as AccentColor)}
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
                  onChange={(event) => onThemeChange(event.target.value as ThemeMode)}
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
                <strong>{documentCount} files loaded</strong>
              </div>
              <div className="info-row">
                <span>Template Components</span>
                <strong>{templateCount} elements saved</strong>
              </div>
            </div>

            <div className="settings-divider" />

            <div className="settings-actions-bar">
              <button
                type="button"
                className="secondary-button"
                style={{ width: "auto" }}
                onClick={onReturnToEditor}
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

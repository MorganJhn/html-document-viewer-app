import type { DocumentSettings } from '../types'

export const DEFAULT_SETTINGS: DocumentSettings = {
  pageSizePreset: 'A4',
  orientation: 'portrait',
  width: '210mm',
  height: '297mm',
  marginTop: '20mm',
  marginRight: '20mm',
  marginBottom: '20mm',
  marginLeft: '20mm',
  backgroundColor: '#ffffff',
}

export function buildSettingsCss(settings: DocumentSettings) {
  const pageSize =
    settings.pageSizePreset === 'Custom'
      ? `${settings.width} ${settings.height}`
      : `${settings.pageSizePreset} ${settings.orientation}`
  const margins = `${settings.marginTop} ${settings.marginRight} ${settings.marginBottom} ${settings.marginLeft}`

  return `
@page {
  size: ${pageSize};
  margin: ${margins};
}
html,
body {
  background: ${settings.backgroundColor};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.pagedjs_page {
  background: ${settings.backgroundColor};
}
`
}

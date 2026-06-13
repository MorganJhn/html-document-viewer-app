import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from '../../shared/document-settings';

export { DEFAULT_DOCUMENT_SETTINGS as DEFAULT_SETTINGS };

export type { DocumentSettings };

export function resolvePageSize(settings: DocumentSettings): { width: string; height: string } {
  const orient = settings.orientation || 'portrait'
  switch (settings.pageSizePreset) {
    case 'A4':
      return orient === 'landscape'
        ? { width: '297mm', height: '210mm' }
        : { width: '210mm', height: '297mm' }
    case 'Letter':
      return orient === 'landscape'
        ? { width: '11in', height: '8.5in' }
        : { width: '8.5in', height: '11in' }
    case 'Legal':
      return orient === 'landscape'
        ? { width: '14in', height: '8.5in' }
        : { width: '8.5in', height: '14in' }
    case 'Slide16_9':
      return { width: '297mm', height: '167mm' }
    case 'Custom':
    default:
      return {
        width: settings.width || '210mm',
        height: settings.height || '297mm',
      }
  }
}

export function buildSettingsCss(settings: DocumentSettings) {
  const { width, height } = resolvePageSize(settings)
  const pageSize = `${width} ${height}`
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

export function cssLengthToPx(length: string): number {
  const value = parseFloat(length)
  if (isNaN(value)) return 0
  if (length.endsWith('mm')) {
    return value * 3.779527559
  }
  if (length.endsWith('in')) {
    return value * 96
  }
  if (length.endsWith('cm')) {
    return value * 37.79527559
  }
  if (length.endsWith('pt')) {
    return value * 1.333333333
  }
  return value
}

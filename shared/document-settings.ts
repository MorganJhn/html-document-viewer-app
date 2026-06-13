export interface DocumentSettings {
  pageSizePreset: 'A4' | 'Letter' | 'Legal' | 'Slide16_9' | 'Custom';
  orientation: 'portrait' | 'landscape';
  width: string;
  height: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  backgroundColor: string;
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  pageSizePreset: 'A4',
  orientation: 'portrait',
  width: '210mm',
  height: '297mm',
  marginTop: '20mm',
  marginRight: '20mm',
  marginBottom: '20mm',
  marginLeft: '20mm',
  backgroundColor: '#ffffff',
};

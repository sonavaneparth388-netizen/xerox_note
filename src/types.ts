export type Language = 'en' | 'hi' | 'mr';

export type Step = 
  | 'welcome' 
  | 'language' 
  | 'upload-source' 
  | 'security-scan' 
  | 'preview' 
  | 'settings' 
  | 'payment' 
  | 'printing' 
  | 'thank-you';

export interface FileData {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  pages: number;
}

export interface PrintSettings {
  copies: number;
  type: 'bw' | 'color';
  orientation: 'portrait' | 'landscape';
  paperSize: 'A4' | 'A3' | 'Letter';
  sides: 'single' | 'double';
  pages: 'all' | 'custom';
  quality: 'draft' | 'standard' | 'high';
}

export interface SessionState {
  id: string | null;
  language: Language;
  files: FileData[];
  currentFileIndex: number;
  settings: PrintSettings;
  totalCost: number;
  paymentStatus: 'pending' | 'verifying' | 'completed';
}

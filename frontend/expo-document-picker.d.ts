declare module 'expo-document-picker' {
  export interface DocumentPickerAsset {
    uri: string;
    name: string;
    mimeType?: string | null;
    size?: number;
    lastModified?: number;
    file?: Blob | null;
  }

  export interface DocumentPickerOptions {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  }

  export interface DocumentPickerSuccessResult {
    canceled: false;
    assets: DocumentPickerAsset[];
  }

  export interface DocumentPickerCanceledResult {
    canceled: true;
    assets: null;
  }

  export type DocumentPickerResult = DocumentPickerSuccessResult | DocumentPickerCanceledResult;

  export function getDocumentAsync(options?: DocumentPickerOptions): Promise<DocumentPickerResult>;
}

export interface ChatAnswerSource {
  type: string;
  reference?: string;
}

export interface ChatbotResponse {
  answer: string;
  source?: ChatAnswerSource;
  disclaimer?: string;
}

export interface ChatbotRequest {
  question: string;
  comunidad_id?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  source?: ChatAnswerSource;
  disclaimer?: string;
}

export interface DocumentsListResponse {
  documents: string[];
}

export interface UploadDocumentResponse {
  message: string;
  chunks: number;
  uploaded_by: string;
}

export interface DeleteDocumentResponse {
  message: string;
  deleted_chunks: number;
  document_title: string;
}

export interface ManualDocumentPayload {
  communityId: string;
  title: string;
  content: string;
}

export interface NativeDocumentFile {
  kind: 'native';
  uri: string;
  name: string;
  mimeType: string;
}

export interface WebDocumentFile {
  kind: 'web';
  name: string;
  mimeType: string;
  blob: Blob;
}

export type UploadDocumentFile = NativeDocumentFile | WebDocumentFile;

export interface FileDocumentPayload {
  communityId: string;
  file: UploadDocumentFile;
}

export type UploadDocumentPayload = ManualDocumentPayload | FileDocumentPayload;

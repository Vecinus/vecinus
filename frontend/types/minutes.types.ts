export enum MeetingType {
  ORDINARY = "ORDINARY",
  EXTRAORDINARY = "EXTRAORDINARY",
}

export enum MinuteStatus {
  DRAFT = "DRAFT",
  PENDING_SIGNATURES = "PENDING_SIGNATURES",
  SIGNED = "SIGNED",
}

export enum AgreementResult {
  APPROVED = "APPROVED",
  DENIED = "DENIED",
}

export interface Agreement {
  description: string;
  result: AgreementResult;
  details?: string;
}

export interface Task {
  responsible: string;
  description: string;
  deadline: string;
}

export interface AIGeneratedContent {
  transcription: string;
  summary: string;
  topics: string[];
  agreements: Agreement[];
  tasks: Task[];
}

export interface MinutesResponse extends AIGeneratedContent {
  title: string;
  scheduled_at: string;
  location: string;
  meeting_type: MeetingType;
  version: number;
  document_hash?: string;
}

export interface MinutesReadResponse extends MinutesResponse {
  id: string;
  association_id: string;
  status: MinuteStatus;
  created_at?: string;
  updated_at?: string;
  locked_at?: string;
}

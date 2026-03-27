export type MeetingType = "ORDINARY" | "EXTRAORDINARY";
export type MinuteStatus = "DRAFT" | "PENDING_SIGNATURES" | "SIGNED";
export type MeetingRole = "PRESIDENT" | "SECRETARY" | "ATTENDEE";
export type AgreementResult = "APPROVED" | "DENIED";

export interface ActaAttendee {
  name: string;
  role: MeetingRole;
  is_present: boolean;
  represented_by?: string;
}

export interface ActaAgreement {
  description: string;
  result: AgreementResult;
  details?: string;
}

export interface ActaTask {
  responsible: string;
  description: string;
  deadline: string;
}

export interface Acta {
  // Database fields
  id: string;
  association_id: string;
  type: MeetingType;
  status: MinuteStatus;
  version: number;
  created_at?: string;
  updated_at?: string;
  locked_at?: string;
  title: string;
  location: string;
  scheduled_at: string;
  
  // Fields from content_json (flattened in the frontend for convenience)
  transcription: string;
  summary: string;
  topics: string[];
  agreements: ActaAgreement[];
  tasks: ActaTask[];
  attendees: ActaAttendee[];
  
  // Optional/Computed fields
  document_hash?: string;
}

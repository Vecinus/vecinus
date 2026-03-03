export interface ActaTask {
  responsible: string;
  description: string;
  deadline: string;
}

export interface Acta {
  id: string;
  title: string;
  date: string;
  executiveSummary: string;
  agreements: string[];
  transcript: string;
  topics?: string[];
  tasks?: ActaTask[];
  createdBy: string;
  status: "draft" | "published";
  signature?: string; // Base64 de la firma
  signedBy?: string;
  signedAt?: string;
}

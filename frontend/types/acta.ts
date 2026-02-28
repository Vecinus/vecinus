export interface Acta {
  id: string;
  title: string;
  date: string;
  executiveSummary: string;
  agreements: string[];
  transcript: string;
  createdBy: string;
  status: "draft" | "published";
  signature?: string; // Base64 de la firma
  signedBy?: string;
  signedAt?: string;
}

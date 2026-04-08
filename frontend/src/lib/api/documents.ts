import { apiFetch } from "@/lib/api/client";
import type { CandidateDocument, DocumentType } from "@/lib/api/types";

export function fetchDocuments(accessToken: string, limit = 20) {
  return apiFetch<CandidateDocument[]>(`/documents?limit=${limit}`, {
    method: "GET",
    accessToken,
  });
}

export function uploadDocument(
  accessToken: string,
  payload: {
    documentType: DocumentType;
    file: File;
  },
) {
  const formData = new FormData();
  formData.set("document_type", payload.documentType);
  formData.set("file", payload.file);

  return apiFetch<CandidateDocument>("/documents/upload", {
    method: "POST",
    accessToken,
    body: formData,
  });
}

export function createTextDocument(
  accessToken: string,
  payload: {
    documentType: Extract<DocumentType, "job_description" | "project_notes" | "interview_feedback">;
    title?: string;
    content: string;
  },
) {
  return apiFetch<CandidateDocument>("/documents/text", {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      document_type: payload.documentType,
      title: payload.title,
      content: payload.content,
    }),
  });
}

export function parseDocument(accessToken: string, documentId: number) {
  return apiFetch<CandidateDocument>(`/documents/${documentId}/parse`, {
    method: "POST",
    accessToken,
  });
}

export function chunkDocument(accessToken: string, documentId: number) {
  return apiFetch<{ document_id: number; chunk_count: number }>(`/documents/${documentId}/chunk`, {
    method: "POST",
    accessToken,
  });
}

export function reindexDocument(accessToken: string, documentId: number) {
  return apiFetch<{ document_id: number; chunk_count: number; indexing_status: string }>(
    `/documents/${documentId}/reindex`,
    {
      method: "POST",
      accessToken,
    },
  );
}

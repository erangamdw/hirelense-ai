import { apiFetch } from "@/lib/api/client";
import type {
  CandidateDocument,
  RecruiterCandidate,
  RecruiterCandidatePayload,
  RecruiterCandidateReview,
  RecruiterDashboardSummary,
  RecruiterJobDetail,
  RecruiterJobList,
  RecruiterJobPayload,
  RecruiterJobReview,
} from "@/lib/api/types";

export function fetchRecruiterDashboard(accessToken: string) {
  return apiFetch<RecruiterDashboardSummary>("/recruiter/dashboard", {
    method: "GET",
    accessToken,
  });
}

export function fetchRecruiterJobs(accessToken: string) {
  return apiFetch<RecruiterJobList>("/recruiter/jobs", {
    method: "GET",
    accessToken,
  });
}

export function createRecruiterJob(accessToken: string, payload: RecruiterJobPayload) {
  return apiFetch<RecruiterJobDetail>("/recruiter/jobs", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });
}

export function fetchRecruiterJobDetail(accessToken: string, jobId: number) {
  return apiFetch<RecruiterJobDetail>(`/recruiter/jobs/${jobId}`, {
    method: "GET",
    accessToken,
  });
}

export function fetchRecruiterJobReview(accessToken: string, jobId: number) {
  return apiFetch<RecruiterJobReview>(`/recruiter/jobs/${jobId}/review`, {
    method: "GET",
    accessToken,
  });
}

export function createRecruiterCandidate(
  accessToken: string,
  jobId: number,
  payload: RecruiterCandidatePayload,
) {
  return apiFetch<RecruiterCandidate>(`/recruiter/jobs/${jobId}/candidates`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });
}

export function fetchRecruiterCandidateReview(
  accessToken: string,
  jobId: number,
  candidateId: number,
) {
  return apiFetch<RecruiterCandidateReview>(
    `/recruiter/jobs/${jobId}/candidates/${candidateId}/review`,
    {
      method: "GET",
      accessToken,
    },
  );
}

export function uploadRecruiterJobDocument(
  accessToken: string,
  jobId: number,
  payload: {
    file: File;
  },
) {
  const formData = new FormData();
  formData.set("document_type", "job_description");
  formData.set("file", payload.file);

  return apiFetch<CandidateDocument>(`/recruiter/jobs/${jobId}/documents/upload`, {
    method: "POST",
    accessToken,
    body: formData,
  });
}

export function uploadRecruiterCandidateDocument(
  accessToken: string,
  jobId: number,
  candidateId: number,
  payload: {
    documentType: "recruiter_candidate_cv" | "interview_feedback";
    file: File;
  },
) {
  const formData = new FormData();
  formData.set("document_type", payload.documentType);
  formData.set("file", payload.file);

  return apiFetch<CandidateDocument>(
    `/recruiter/jobs/${jobId}/candidates/${candidateId}/documents/upload`,
    {
      method: "POST",
      accessToken,
      body: formData,
    },
  );
}

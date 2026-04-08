import { apiFetch } from "@/lib/api/client";
import type {
  CandidateDocument,
  RecruiterCandidate,
  RecruiterCandidateComparison,
  RecruiterCandidateShortlistStatus,
  RecruiterCandidatePayload,
  RecruiterCandidateReview,
  RecruiterDashboardSummary,
  RecruiterJobDetail,
  RecruiterJobList,
  RecruiterJobPayload,
  RecruiterProfile,
  RecruiterProfilePayload,
  RecruiterJobReview,
} from "@/lib/api/types";

export function fetchRecruiterDashboard(accessToken: string) {
  return apiFetch<RecruiterDashboardSummary>("/recruiter/dashboard", {
    method: "GET",
    accessToken,
  });
}

export function fetchRecruiterProfile(accessToken: string) {
  return apiFetch<RecruiterProfile>("/recruiter/profile", {
    method: "GET",
    accessToken,
  });
}

export function createRecruiterProfile(accessToken: string, payload: RecruiterProfilePayload) {
  return apiFetch<RecruiterProfile>("/recruiter/profile", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });
}

export function fetchRecruiterJobComparison(accessToken: string, jobId: number) {
  return apiFetch<RecruiterCandidateComparison>(`/recruiter/jobs/${jobId}/comparison`, {
    method: "GET",
    accessToken,
  });
}

export function updateRecruiterCandidateStatus(
  accessToken: string,
  jobId: number,
  candidateId: number,
  shortlistStatus: RecruiterCandidateShortlistStatus,
) {
  return apiFetch<RecruiterCandidate>(`/recruiter/jobs/${jobId}/candidates/${candidateId}/status`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ shortlist_status: shortlistStatus }),
  });
}

export function updateRecruiterProfile(accessToken: string, payload: RecruiterProfilePayload) {
  return apiFetch<RecruiterProfile>("/recruiter/profile", {
    method: "PUT",
    accessToken,
    body: JSON.stringify(payload),
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

export function updateRecruiterJob(accessToken: string, jobId: number, payload: RecruiterJobPayload) {
  return apiFetch<RecruiterJobDetail>(`/recruiter/jobs/${jobId}`, {
    method: "PUT",
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

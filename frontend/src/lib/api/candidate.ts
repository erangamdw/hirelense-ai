import { apiFetch } from "@/lib/api/client";
import type {
  CandidateDashboardSummary,
  CandidateProfile,
  CandidateProfilePayload,
} from "@/lib/api/types";

export function fetchCandidateDashboard(accessToken: string) {
  return apiFetch<CandidateDashboardSummary>("/candidate/dashboard", {
    method: "GET",
    accessToken,
  });
}

export function fetchCandidateProfile(accessToken: string) {
  return apiFetch<CandidateProfile>("/candidate/profile", {
    method: "GET",
    accessToken,
  });
}

export function createCandidateProfile(
  accessToken: string,
  payload: CandidateProfilePayload,
) {
  return apiFetch<CandidateProfile>("/candidate/profile", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });
}

export function updateCandidateProfile(
  accessToken: string,
  payload: CandidateProfilePayload,
) {
  return apiFetch<CandidateProfile>("/candidate/profile", {
    method: "PUT",
    accessToken,
    body: JSON.stringify(payload),
  });
}

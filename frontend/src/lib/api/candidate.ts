import { apiFetch } from "@/lib/api/client";
import type { CandidateDashboardSummary } from "@/lib/api/types";

export function fetchCandidateDashboard(accessToken: string) {
  return apiFetch<CandidateDashboardSummary>("/candidate/dashboard", {
    method: "GET",
    accessToken,
  });
}

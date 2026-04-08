import { apiFetch } from "@/lib/api/client";
import type { RecruiterDashboardSummary } from "@/lib/api/types";

export function fetchRecruiterDashboard(accessToken: string) {
  return apiFetch<RecruiterDashboardSummary>("/recruiter/dashboard", {
    method: "GET",
    accessToken,
  });
}

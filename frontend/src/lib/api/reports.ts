import { apiFetch } from "@/lib/api/client";
import type { ReportType, SavedReport, SavedReportHistory } from "@/lib/api/types";

export function createReport(
  accessToken: string,
  payload: {
    reportType: ReportType;
    query: string;
    title?: string;
    payload: Record<string, unknown>;
  },
) {
  return apiFetch<SavedReport>("/reports", {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      report_type: payload.reportType,
      query: payload.query,
      title: payload.title,
      payload: payload.payload,
    }),
  });
}

export function fetchReportHistory(
  accessToken: string,
  options?: {
    reportType?: ReportType | "all";
    limit?: number;
  },
) {
  const searchParams = new URLSearchParams();
  if (options?.reportType && options.reportType !== "all") {
    searchParams.set("report_type", options.reportType);
  }
  if (options?.limit) {
    searchParams.set("limit", String(options.limit));
  }

  const suffix = searchParams.size ? `?${searchParams.toString()}` : "";
  return apiFetch<SavedReportHistory>(`/reports${suffix}`, {
    method: "GET",
    accessToken,
  });
}

export function fetchReportDetail(accessToken: string, reportId: number) {
  return apiFetch<SavedReport>(`/reports/${reportId}`, {
    method: "GET",
    accessToken,
  });
}

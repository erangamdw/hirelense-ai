"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchReportHistory } from "@/lib/api/reports";
import type { ReportType, SavedReportHistory } from "@/lib/api/types";
import { formatDateTime, formatLabel } from "@/lib/utils";

const recruiterReportOptions: Array<{ value: ReportType | "all"; label: string }> = [
  { value: "all", label: "All recruiter reports" },
  { value: "recruiter_fit_summary", label: "Fit summaries" },
  { value: "recruiter_interview_pack", label: "Interview packs" },
];

export function RecruiterReportsPage({
  recruiterJobId,
  recruiterCandidateId,
}: {
  recruiterJobId?: number;
  recruiterCandidateId?: number;
}) {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [reportType, setReportType] = useState<ReportType | "all">("all");
  const [history, setHistory] = useState<SavedReportHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    fetchReportHistory(accessToken, {
      reportType,
      limit: 30,
      recruiterJobId,
      recruiterCandidateId,
    })
      .then((payload) => {
        setHistory(payload);
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter report history.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isRecruiterSession, recruiterCandidateId, recruiterJobId, reportType]);

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to review recruiter reports"
        message="The recruiter report history page loads persisted recruiter outputs from the backend reports API."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter reports unavailable"
        message="This route expects a recruiter account."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Recruiter report history request failed" message={error} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recruiter reports</CardTitle>
        <CardDescription>Filter persisted recruiter outputs and open detailed views backed by `/reports/:id`.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Filter by type</p>
            <p className="text-sm text-[var(--color-ink-muted)]">Current total: {history?.total ?? 0}</p>
            {recruiterJobId || recruiterCandidateId ? (
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                {[
                  recruiterJobId ? `Job ${recruiterJobId}` : null,
                  recruiterCandidateId ? `Candidate ${recruiterCandidateId}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value as ReportType | "all")}
            className="flex h-11 w-full max-w-xs rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-4 focus:ring-[var(--color-ring)]"
          >
            {recruiterReportOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {history?.items.length ? (
          history.items.map((report) => (
            <Link
              key={report.id}
              href={`/recruiter/reports/${report.id}`}
              className="block rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{report.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{report.query}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                    {formatDateTime(report.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{formatLabel(report.report_type)}</Badge>
                  {report.recruiter_job_id ? <Badge>{`Job ${report.recruiter_job_id}`}</Badge> : null}
                  {report.recruiter_candidate_id ? <Badge>{`Candidate ${report.recruiter_candidate_id}`}</Badge> : null}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No recruiter reports match this filter yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

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

const reportOptions: Array<{ value: ReportType | "all"; label: string }> = [
  { value: "all", label: "All report types" },
  { value: "candidate_interview_questions", label: "Interview questions" },
  { value: "candidate_answer_guidance", label: "Answer guidance" },
  { value: "candidate_star_answer", label: "STAR answer" },
  { value: "candidate_skill_gap_analysis", label: "Skill-gap analysis" },
];

export function CandidateReportsPage() {
  const { accessToken, status, user } = useAuth();
  const isCandidateSession = status === "authenticated" && !!accessToken && user?.role === "candidate";
  const [reportType, setReportType] = useState<ReportType | "all">("all");
  const [history, setHistory] = useState<SavedReportHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCandidateSession || !accessToken) {
      return;
    }

    fetchReportHistory(accessToken, { reportType, limit: 30 })
      .then((payload) => {
        setHistory(payload);
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load report history.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isCandidateSession, reportType]);

  if (status === "loading" || (isCandidateSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to review saved reports"
        message="The report history page loads persisted candidate outputs from the backend reports API."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate reports unavailable"
        message="This route expects a candidate account."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Report history request failed" message={error} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved reports</CardTitle>
        <CardDescription>Filter persisted candidate reports and open detail pages backed by `/reports/:id`.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Filter by type</p>
            <p className="text-sm text-[var(--color-ink-muted)]">Current total: {history?.total ?? 0}</p>
          </div>
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value as ReportType | "all")}
            className="flex h-11 w-full max-w-xs rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-4 focus:ring-[var(--color-ring)]"
          >
            {reportOptions.map((option) => (
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
              href={`/candidate/reports/${report.id}`}
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
                <Badge>{formatLabel(report.report_type)}</Badge>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No saved reports match this filter yet. The page is ready for candidate generation flows to start persisting output.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCandidateDashboard } from "@/lib/api/candidate";
import { fetchDocuments } from "@/lib/api/documents";
import { fetchReportHistory } from "@/lib/api/reports";
import type {
  CandidateDashboardSummary,
  CandidateDocument,
  SavedReportListItem,
} from "@/lib/api/types";
import { formatBytes, formatDateTime, formatLabel } from "@/lib/utils";

type DashboardState = {
  summary: CandidateDashboardSummary;
  documents: CandidateDocument[];
  reports: SavedReportListItem[];
};

export function CandidateDashboard() {
  const { accessToken, status, user } = useAuth();
  const isCandidateSession = status === "authenticated" && !!accessToken && user?.role === "candidate";
  const [data, setData] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isCandidateSession || !accessToken) {
      return;
    }

    Promise.all([
      fetchCandidateDashboard(accessToken),
      fetchDocuments(accessToken, 4),
      fetchReportHistory(accessToken, { limit: 4 }),
    ])
      .then(([summary, documents, reports]) => {
        setData({
          summary,
          documents,
          reports: reports.items,
        });
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load candidate workspace.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isCandidateSession]);

  if (status === "loading" || (isCandidateSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open the candidate workspace"
        message="Open your candidate workspace to manage documents, run interview prep, and review saved reports."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate dashboard unavailable"
        message="This page is only available to candidate accounts. Recruiters should use the recruiter workspace."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Dashboard request failed" message={error} />;
  }

  if (!data) {
    return <EmptyState title="No dashboard data yet" message="Your candidate summary is not available yet. Try refreshing the page." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          label="Documents"
          value={data.summary.uploaded_document_count}
          hint="Documents available for preparation and grounded generation."
        />
        <DashboardCard
          label="Reports"
          value={data.summary.saved_report_count}
          hint="Saved interview-prep outputs you can review later."
        />
        <DashboardCard
          label="Profile"
          value={data.summary.has_profile ? "Ready" : "Missing"}
          hint="Keep your profile current so generated outputs match your target roles."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent documents</CardTitle>
            <CardDescription>Use these documents as the evidence base for interview questions, answer guidance, and skills analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.documents.length ? (
              data.documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-ink)]">{document.original_filename}</p>
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                        {formatLabel(document.document_type)} · {formatBytes(document.size_bytes)} · {formatDateTime(document.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{document.parsing_status}</Badge>
                      <Badge>{document.indexing_status}</Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                No candidate documents yet. Start with a CV or paste a job description.
              </p>
            )}
            <Link className="text-sm font-semibold text-[var(--color-accent)]" href="/candidate/documents">
              Open document intake
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Move through the core preparation flow from profile setup to saved reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]" href="/candidate/profile">
              Complete or update profile
            </Link>
            <Link className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]" href="/candidate/documents">
              Upload CV and job context
            </Link>
            <Link className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]" href="/candidate/interview">
              Run interview assistant
            </Link>
            <Link className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]" href="/candidate/reports">
              Review saved reports
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Target roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.summary.target_roles.length ? (
                data.summary.target_roles.map((role) => <Badge key={role}>{role}</Badge>)
              ) : (
                <p className="text-sm text-[var(--color-ink-muted)]">
                  No target roles saved yet. Add them on the profile page.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent reports</CardTitle>
            <CardDescription>Return to previous interview-prep outputs and continue refining your answers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.reports.length ? (
              data.reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/candidate/reports/${report.id}`}
                  className="block rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-ink)]">{report.title}</p>
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                        {formatDateTime(report.created_at)} · {formatLabel(report.report_type)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-paper)]">
                      View
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                No saved candidate reports yet. Run the interview assistant and save an output to populate this history.
              </p>
            )}
            <Link className="text-sm font-semibold text-[var(--color-accent)]" href="/candidate/reports">
              Open report history
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

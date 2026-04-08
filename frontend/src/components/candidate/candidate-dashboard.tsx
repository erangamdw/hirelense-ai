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
        message="The candidate workflow now uses live profile, document, and report APIs."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate dashboard unavailable"
        message="This route expects a candidate account. Recruiters should use the recruiter workspace."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Dashboard request failed" message={error} />;
  }

  if (!data) {
    return <EmptyState title="No dashboard data yet" message="The API did not return candidate dashboard content." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          label="Documents"
          value={data.summary.uploaded_document_count}
          hint="Live document count from the candidate dashboard summary."
        />
        <DashboardCard
          label="Reports"
          value={data.summary.saved_report_count}
          hint="Saved candidate outputs now load from the persisted reports API."
        />
        <DashboardCard
          label="Profile"
          value={data.summary.has_profile ? "Ready" : "Missing"}
          hint="Candidate profile state comes from the live profile-backed summary endpoint."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent documents</CardTitle>
            <CardDescription>Uploads and pasted job descriptions are processed through the backend intake pipeline.</CardDescription>
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
            <CardDescription>Use the candidate workspace pages rather than placeholder shell sections.</CardDescription>
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
            <CardDescription>Report history comes from `/reports`, with filterable detail pages in the candidate shell.</CardDescription>
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
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{formatDateTime(report.created_at)}</p>
                    </div>
                    <Badge>{formatLabel(report.report_type)}</Badge>
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

"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { EvidencePanel } from "@/components/shared/evidence-panel";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchRecruiterDashboard } from "@/lib/api/recruiter";
import type { RecruiterDashboardSummary } from "@/lib/api/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RecruiterDashboard() {
  const { accessToken, status, user } = useAuth();
  const [summary, setSummary] = useState<RecruiterDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || user?.role !== "recruiter") {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchRecruiterDashboard(accessToken)
      .then((payload) => {
        setSummary(payload);
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter dashboard.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, status, user?.role]);

  if (status === "loading" || loading) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open the recruiter dashboard"
        message="The recruiter shell already uses the real recruiter summary endpoint."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter dashboard unavailable"
        message="This route expects a recruiter account. Candidates should use the candidate dashboard shell."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Dashboard request failed" message={error} />;
  }

  if (!summary) {
    return <EmptyState title="No recruiter summary yet" message="The API did not return dashboard content." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <DashboardCard label="Jobs" value={summary.jobs_count} hint="Directly from /recruiter/dashboard." />
        <DashboardCard label="Candidates" value={summary.candidate_count} hint="Tracked recruiter-side candidate intake count." />
        <DashboardCard
          label="Documents"
          value={summary.candidate_document_count}
          hint="Candidate document volume available for review flows."
        />
        <DashboardCard label="Reports" value={summary.report_count} hint="Saved recruiter outputs are now persisted." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent recruiter reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recent_reports.length ? (
              summary.recent_reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-ink)]">{report.title}</p>
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{formatDate(report.created_at)}</p>
                    </div>
                    <Badge>{report.report_type}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                No saved recruiter reports yet. The save/list/detail backend is ready for the next UI slice.
              </p>
            )}
          </CardContent>
        </Card>

        <EvidencePanel
          items={[
            {
              label: "Review pages",
              detail: "Backend job-review and candidate-review aggregates are ready for the next recruiter UI milestone.",
            },
            {
              label: "Scope",
              detail: "Recruiter retrieval and saved reports already support recruiter job and recruiter candidate filters.",
            },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card id="review">
          <CardHeader>
            <CardTitle>Recent candidate names</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {summary.recent_candidate_names.length ? (
              summary.recent_candidate_names.map((name) => <Badge key={name}>{name}</Badge>)
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                Candidate names will appear here as recruiter intake continues.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next UI slice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--color-ink-muted)]">
            <p>Job list, job detail, candidate review, and report detail screens can now build on stable backend contracts.</p>
            <p>This foundation milestone keeps the shell thin and aligned to the API that already exists.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

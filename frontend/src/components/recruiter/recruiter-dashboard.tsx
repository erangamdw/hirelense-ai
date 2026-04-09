"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { EvidencePanel } from "@/components/shared/evidence-panel";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchRecruiterDashboard,
  fetchRecruiterJobDetail,
  fetchRecruiterJobs,
} from "@/lib/api/recruiter";
import type { RecruiterDashboardSummary, RecruiterJobDetail } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RecruiterDashboard() {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [summary, setSummary] = useState<RecruiterDashboardSummary | null>(null);
  const [analysisTargets, setAnalysisTargets] = useState<
    Array<{
      jobId: number;
      candidateId: number;
      candidateName: string;
      jobTitle: string;
      currentTitle: string | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    Promise.all([fetchRecruiterDashboard(accessToken), fetchRecruiterJobs(accessToken)])
      .then(async ([payload, jobs]) => {
        const detailJobs: RecruiterJobDetail[] = await Promise.all(
          jobs.items.slice(0, 3).map((job) => fetchRecruiterJobDetail(accessToken, job.id)),
        );
        const nextTargets = detailJobs
          .flatMap((job) =>
            job.candidates.slice(0, 2).map((candidate) => ({
              jobId: job.id,
              candidateId: candidate.id,
              candidateName: candidate.full_name,
              jobTitle: job.title,
              currentTitle: candidate.current_title,
            })),
          )
          .slice(0, 4);

        setSummary(payload);
        setAnalysisTargets(nextTargets);
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter dashboard.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isRecruiterSession]);

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open the recruiter dashboard"
        message="Open the recruiter workspace to manage jobs, candidates, and evidence-backed review workflows."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter dashboard unavailable"
        message="This page is only available to recruiter accounts. Candidates should use the candidate workspace."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Dashboard request failed" message={error} />;
  }

  if (!summary) {
    return <EmptyState title="No recruiter summary yet" message="Your recruiter dashboard summary is not available yet. Try refreshing the page." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <DashboardCard label="Jobs" value={summary.jobs_count} hint="Open roles currently tracked in your workspace." />
        <DashboardCard label="Candidates" value={summary.candidate_count} hint="Candidates added across your active hiring scopes." />
        <DashboardCard
          label="Documents"
          value={summary.candidate_document_count}
          hint="Recruiter-side evidence uploaded for screening and interview prep."
        />
        <DashboardCard label="Reports" value={summary.report_count} hint="Saved fit summaries and interview packs." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent recruiter reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recent_reports.length ? (
              summary.recent_reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/recruiter/reports/${report.id}`}
                  className="block rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-ink)]">{report.title}</p>
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                        {formatDate(report.created_at)} · {formatLabel(report.report_type)}
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
                No recruiter reports yet. Generate a fit summary or interview pack to start building review history.
              </p>
            )}
          </CardContent>
        </Card>

        <EvidencePanel
          items={[
            {
              label: "Review workflow",
              detail: "Create a job, upload candidate evidence, and move from job detail into fit summaries, interview packs, and comparison.",
            },
            {
              label: "Scoped evidence",
              detail: "Each report stays tied to the correct job and candidate so recruiter review does not mix signals across roles.",
            },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card id="review">
          <CardHeader>
            <CardTitle>Candidate analyses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysisTargets.length ? (
              analysisTargets.map((target) => (
                <Link
                  key={`${target.jobId}-${target.candidateId}`}
                  href={`/recruiter/jobs/${target.jobId}/candidates/${target.candidateId}/analysis`}
                  className="block rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
                >
                  <p className="font-medium text-[var(--color-ink)]">{target.candidateName}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{target.currentTitle || "No current title"}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">{target.jobTitle}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                Candidate analysis links will appear here after you add candidates to a job.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recruiter workspace actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]" href="/recruiter/setup">
              Open recruiter setup
            </Link>
            <Link className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]" href="/recruiter/jobs">
              Open recruiter jobs
            </Link>
            <Link className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]" href="/recruiter/reports">
              Open recruiter reports
            </Link>
            <p className="text-[var(--color-ink-muted)]">
              Use setup for company details, jobs for hiring scopes, and reports for saved recruiter decisions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

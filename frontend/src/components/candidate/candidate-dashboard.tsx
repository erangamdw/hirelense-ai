"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { EvidencePanel } from "@/components/shared/evidence-panel";
import { FileUploadCard } from "@/components/shared/file-upload";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCandidateDashboard } from "@/lib/api/candidate";
import type { CandidateDashboardSummary } from "@/lib/api/types";

export function CandidateDashboard() {
  const { accessToken, status, user } = useAuth();
  const [summary, setSummary] = useState<CandidateDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || user?.role !== "candidate") {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchCandidateDashboard(accessToken)
      .then((payload) => {
        setSummary(payload);
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load dashboard.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, status, user?.role]);

  if (status === "loading" || loading) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open the candidate dashboard"
        message="The frontend foundation is wired to the backend auth API. Use the auth pages first."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate dashboard unavailable"
        message="This route expects a candidate account. Recruiters should use the recruiter dashboard shell."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Dashboard request failed" message={error} />;
  }

  if (!summary) {
    return <EmptyState title="No dashboard data yet" message="The API did not return dashboard content." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          label="Documents"
          value={summary.uploaded_document_count}
          hint="Current uploaded document count from the backend summary endpoint."
        />
        <DashboardCard
          label="Reports"
          value={summary.saved_report_count}
          hint="Saved candidate reports will surface here as the next UI slices land."
        />
        <DashboardCard
          label="Profile"
          value={summary.has_profile ? "Ready" : "Missing"}
          hint="The API already tracks whether a candidate profile exists."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Target roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.target_roles.length ? (
                summary.target_roles.map((role) => <Badge key={role}>{role}</Badge>)
              ) : (
                <p className="text-sm text-[var(--color-ink-muted)]">
                  No target roles yet. The candidate profile screen will fill this in next.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <EvidencePanel
          items={[
            {
              label: "Auth",
              detail: "JWT-backed auth state is stored locally and refreshed against /auth/me.",
            },
            {
              label: "Dashboard",
              detail: "This shell consumes the real /candidate/dashboard response rather than mock data.",
            },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <FileUploadCard
          title="Upload surface placeholder"
          description="The shared upload component is ready for the candidate upload flow milestone."
        />

        <Card id="documents">
          <CardHeader>
            <CardTitle>Latest interview context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.latest_interview_sessions.length ? (
              summary.latest_interview_sessions.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink-muted)]"
                >
                  {item}
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                No interview sessions are being returned yet. This placeholder is wired for that future backend field.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchRecruiterJobComparison,
  updateRecruiterCandidateStatus,
} from "@/lib/api/recruiter";
import type {
  RecruiterCandidateComparison,
  RecruiterCandidateShortlistStatus,
} from "@/lib/api/types";
import { formatDateTime, formatLabel } from "@/lib/utils";

const shortlistOptions: Array<{
  value: RecruiterCandidateShortlistStatus;
  label: string;
}> = [
  { value: "shortlisted", label: "Shortlisted" },
  { value: "under_review", label: "Under review" },
  { value: "declined", label: "Declined" },
];

function statusBadgeLabel(value: RecruiterCandidateShortlistStatus) {
  return formatLabel(value);
}

type PendingStatusMap = Record<number, RecruiterCandidateShortlistStatus | null>;

export function RecruiterCandidateComparisonPage({ jobId }: { jobId: number }) {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [data, setData] = useState<RecruiterCandidateComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatusMap, setPendingStatusMap] = useState<PendingStatusMap>({});

  async function refreshComparison(token: string) {
    const comparison = await fetchRecruiterJobComparison(token, jobId);
    setData(comparison);
  }

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    fetchRecruiterJobComparison(accessToken, jobId)
      .then((comparison) => {
        setData(comparison);
        setLoadError(null);
      })
      .catch((caughtError) => {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter comparison.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isRecruiterSession, jobId]);

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to compare recruiter candidates"
        message="This comparison page is backed by the live recruiter comparison endpoint."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter comparison unavailable"
        message="This route expects a recruiter account."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Comparison request failed" message={loadError} actionHref={`/recruiter/jobs/${jobId}`} actionLabel="Back to job detail" />;
  }

  if (!data) {
    return <EmptyState title="Comparison not ready" message="The recruiter comparison endpoint did not return any data." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Recruiter comparison</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{data.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-ink-muted)]">{data.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{`${data.candidate_count} candidates`}</Badge>
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href={`/recruiter/jobs/${jobId}`}>
            Back to job detail
          </Link>
        </div>
      </div>

      {statusError ? <p className="text-sm text-[var(--color-danger)]">{statusError}</p> : null}

      {data.candidates.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.candidates.map((candidate) => {
            const pendingStatus = pendingStatusMap[candidate.candidate_id];
            const isUpdatingStatus = pendingStatus !== undefined && pendingStatus !== null;

            return (
              <Card key={candidate.candidate_id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{candidate.full_name}</CardTitle>
                      <CardDescription className="mt-2">
                        {candidate.current_title || "No current title"} · {`${candidate.document_count} docs`} · {`${candidate.report_count} reports`}
                      </CardDescription>
                    </div>
                    <Badge>{statusBadgeLabel(candidate.shortlist_status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {candidate.notes ? (
                    <p className="text-sm leading-6 text-[var(--color-ink-muted)]">{candidate.notes}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {shortlistOptions.map((option) => {
                      const isActive = candidate.shortlist_status === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => {
                            if (!accessToken || option.value === candidate.shortlist_status) {
                              return;
                            }

                            setStatusError(null);
                            setPendingStatusMap((current) => ({
                              ...current,
                              [candidate.candidate_id]: option.value,
                            }));

                            void updateRecruiterCandidateStatus(
                              accessToken,
                              jobId,
                              candidate.candidate_id,
                              option.value,
                            )
                              .then(async () => {
                                await refreshComparison(accessToken);
                              })
                              .catch((caughtError) => {
                                setStatusError(caughtError instanceof Error ? caughtError.message : "Could not update shortlist status.");
                              })
                              .finally(() => {
                                setPendingStatusMap((current) => ({
                                  ...current,
                                  [candidate.candidate_id]: null,
                                }));
                              });
                          }}
                          className={
                            isActive
                              ? "rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-semibold text-[var(--color-paper)]"
                              : "rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
                          }
                        >
                          {isUpdatingStatus && pendingStatus === option.value ? "Updating..." : option.label}
                        </button>
                      );
                    })}
                  </div>

                  {candidate.needs_fit_summary ? (
                    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4">
                      <p className="text-sm font-medium text-[var(--color-ink)]">No saved fit summary yet</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                        Generate a fit summary for this candidate to compare evidence-backed strengths, concerns, and recommendation text here.
                      </p>
                    </div>
                  ) : (
                    <>
                      {candidate.fit_summary_summary ? (
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4">
                          <p className="text-sm font-medium text-[var(--color-ink)]">Fit summary</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{candidate.fit_summary_summary}</p>
                          {candidate.latest_fit_summary_created_at ? (
                            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                              {`Saved ${formatDateTime(candidate.latest_fit_summary_created_at)}`}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-[var(--color-ink)]">Strengths</p>
                          {candidate.strengths.length ? (
                            candidate.strengths.map((item) => (
                              <div key={`${candidate.candidate_id}-${item.title}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                                <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{item.summary}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[var(--color-ink-muted)]">No strengths were saved in the latest fit summary.</p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-[var(--color-ink)]">Concerns</p>
                          {candidate.concerns.length ? (
                            candidate.concerns.map((item) => (
                              <div key={`${candidate.candidate_id}-${item.title}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                                <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{item.summary}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[var(--color-ink-muted)]">No concerns were saved in the latest fit summary.</p>
                          )}
                        </div>
                      </div>

                      {candidate.fit_summary_recommendation ? (
                        <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                          <p className="text-sm font-medium text-[var(--color-ink)]">Recommendation</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{candidate.fit_summary_recommendation}</p>
                        </div>
                      ) : null}

                      {candidate.missing_evidence_areas.length ? (
                        <div className="flex flex-wrap gap-2">
                          {candidate.missing_evidence_areas.map((item) => (
                            <Badge key={`${candidate.candidate_id}-${item}`}>{item}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}

                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link
                      className="inline-flex rounded-full bg-[var(--color-panel)] px-4 py-2 font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
                      href={`/recruiter/jobs/${jobId}/candidates/${candidate.candidate_id}`}
                    >
                      Open candidate
                    </Link>
                    <Link
                      className="inline-flex rounded-full bg-[var(--color-panel)] px-4 py-2 font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
                      href={`/recruiter/jobs/${jobId}/candidates/${candidate.candidate_id}/analysis`}
                    >
                      Open fit summary
                    </Link>
                    <Link
                      className="inline-flex rounded-full bg-[var(--color-panel)] px-4 py-2 font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
                      href={`/recruiter/reports?jobId=${jobId}&candidateId=${candidate.candidate_id}`}
                    >
                      Open reports
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No candidates to compare yet"
          message="Add candidates to this recruiter job first, then this page can compare them side by side."
          actionHref={`/recruiter/jobs/${jobId}`}
          actionLabel="Back to job detail"
        />
      )}
    </div>
  );
}

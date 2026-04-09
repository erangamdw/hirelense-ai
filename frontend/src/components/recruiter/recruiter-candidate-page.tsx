"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchRecruiterCandidateReview,
  fetchRecruiterJobDetail,
  uploadRecruiterCandidateDocument,
} from "@/lib/api/recruiter";
import { RecruiterCandidateNav } from "@/components/recruiter/recruiter-candidate-nav";
import type {
  RecruiterCandidateReview,
  RecruiterJobDetail,
} from "@/lib/api/types";
import { formatDateTime, formatLabel } from "@/lib/utils";

type RecruiterCandidateState = {
  review: RecruiterCandidateReview;
  job: RecruiterJobDetail;
};

export function RecruiterCandidatePage({
  jobId,
  candidateId,
}: {
  jobId: number;
  candidateId: number;
}) {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [data, setData] = useState<RecruiterCandidateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<"recruiter_candidate_cv" | "interview_feedback">(
    "recruiter_candidate_cv",
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function refreshCandidate(token: string) {
    const [review, job] = await Promise.all([
      fetchRecruiterCandidateReview(token, jobId, candidateId),
      fetchRecruiterJobDetail(token, jobId),
    ]);
    setData({ review, job });
  }

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    Promise.all([
      fetchRecruiterCandidateReview(accessToken, jobId, candidateId),
      fetchRecruiterJobDetail(accessToken, jobId),
    ])
      .then(([review, job]) => {
        setData({ review, job });
        setLoadError(null);
      })
      .catch((caughtError) => {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter candidate.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, candidateId, isRecruiterSession, jobId]);

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open recruiter candidate review"
        message="Open the recruiter workspace to review a candidate, upload evidence, and generate recruiter outputs."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter candidate unavailable"
        message="This page is only available to recruiter accounts."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Candidate request failed" message={loadError} actionHref={`/recruiter/jobs/${jobId}`} actionLabel="Back to job detail" />;
  }

  if (!data) {
    return <EmptyState title="Candidate not found" message="We could not load this candidate for the current job." actionHref={`/recruiter/jobs/${jobId}`} actionLabel="Back to job detail" />;
  }

  return (
    <div className="space-y-6">
      <RecruiterCandidateNav jobId={jobId} candidateId={candidateId} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Recruiter candidate review</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{data.review.full_name}</h2>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {data.job.title} · {formatLabel(data.review.shortlist_status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href={`/recruiter/jobs/${jobId}/comparison`}>
            Open comparison
          </Link>
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href={`/recruiter/jobs/${jobId}`}>
            Back to job detail
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Candidate review summary</CardTitle>
            <CardDescription>Review the candidate summary, uploaded evidence, and current shortlist status for this role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--color-ink-muted)]">
            <p>{data.review.current_title || "No current title saved."}</p>
            <p>{data.review.email || "No email saved."}</p>
            {data.review.notes ? <p>{data.review.notes}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Badge>{formatLabel(data.review.shortlist_status)}</Badge>
              <Badge>{`${data.review.document_count} documents`}</Badge>
              <Badge>{`${data.review.report_count} reports`}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.review.document_types.length ? (
                data.review.document_types.map((item) => <Badge key={item}>{formatLabel(item)}</Badge>)
              ) : (
                <p>No recruiter-side document types uploaded yet.</p>
              )}
            </div>
            {data.review.latest_report_title ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
                <p className="font-medium text-[var(--color-ink)]">{data.review.latest_report_title}</p>
                <p className="mt-1">
                  {data.review.latest_report_type ? formatLabel(data.review.latest_report_type) : "Report"} ·{" "}
                  {data.review.latest_report_created_at ? formatDateTime(data.review.latest_report_created_at) : "Unknown time"}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate upload page</CardTitle>
            <CardDescription>Attach a recruiter candidate CV or interview feedback to this scoped candidate record.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!accessToken) {
                  return;
                }

                const form = event.currentTarget;
                const formData = new FormData(form);
                const file = formData.get("candidate_file");
                if (!(file instanceof File) || !file.size) {
                  setError("Choose a candidate file before uploading.");
                  return;
                }

                setIsUploading(true);
                setError(null);
                setFeedback(null);

                void uploadRecruiterCandidateDocument(accessToken, jobId, candidateId, {
                  documentType: uploadType,
                  file,
                })
                  .then(async () => {
                    setFeedback(`${formatLabel(uploadType)} uploaded.`);
                    form.reset();
                    await refreshCandidate(accessToken);
                  })
                  .catch((caughtError) => {
                    setError(caughtError instanceof Error ? caughtError.message : "Could not upload candidate document.");
                  })
                  .finally(() => setIsUploading(false));
              }}
            >
              <select
                value={uploadType}
                onChange={(event) => {
                  setUploadType(event.target.value as "recruiter_candidate_cv" | "interview_feedback");
                }}
                className="flex h-11 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-4 focus:ring-[var(--color-ring)]"
              >
                <option value="recruiter_candidate_cv">Recruiter candidate CV</option>
                <option value="interview_feedback">Interview feedback</option>
              </select>
              <Input name="candidate_file" type="file" accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" required />
              {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
              {feedback ? <p className="text-sm text-[var(--color-teal)]">{feedback}</p> : null}
              <Button type="submit" disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload candidate document"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recruiter analysis actions</CardTitle>
          <CardDescription>Generate recruiter-facing analysis and interview screens from this candidate scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Link
            className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
            href={`/recruiter/jobs/${jobId}/candidates/${candidateId}/analysis`}
          >
            Open fit summary analysis
          </Link>
          <Link
            className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
            href={`/recruiter/jobs/${jobId}/candidates/${candidateId}/interview-pack`}
          >
            Open interview pack
          </Link>
          <Link
            className="block rounded-2xl bg-white px-4 py-3 text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
            href={`/recruiter/reports?jobId=${jobId}&candidateId=${candidateId}`}
          >
            Open scoped recruiter reports
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report history summary</CardTitle>
          <CardDescription>Saved recruiter reports already tied to this candidate scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.review.report_history.length ? (
            data.review.report_history.map((report) => (
              <Link
                key={report.id}
                href={`/recruiter/reports/${report.id}`}
                className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
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
              No recruiter reports are attached to this candidate yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

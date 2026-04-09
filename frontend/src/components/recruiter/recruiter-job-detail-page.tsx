"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  RecruiterCandidateCreateDialog,
  type RecruiterCandidateFormState,
} from "@/components/recruiter/recruiter-candidate-create-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createRecruiterCandidate,
  deleteRecruiterJob,
  fetchRecruiterJobDetail,
  fetchRecruiterJobReview,
  uploadRecruiterCandidateDocument,
  uploadRecruiterJobDocument,
} from "@/lib/api/recruiter";
import type {
  RecruiterCandidatePayload,
  RecruiterJobDetail,
  RecruiterJobReview,
} from "@/lib/api/types";
import { formatDateTime, formatLabel } from "@/lib/utils";

const emptyCandidateForm: RecruiterCandidateFormState = {
  full_name: "",
  email: "",
  current_title: "",
  notes: "",
};

function buildCandidatePayload(form: RecruiterCandidateFormState): RecruiterCandidatePayload {
  return {
    full_name: form.full_name.trim(),
    email: form.email.trim() || null,
    current_title: form.current_title.trim() || null,
    notes: form.notes.trim() || null,
  };
}

type RecruiterJobState = {
  detail: RecruiterJobDetail;
  review: RecruiterJobReview;
};

export function RecruiterJobDetailPage({ jobId }: { jobId: number }) {
  const router = useRouter();
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [data, setData] = useState<RecruiterJobState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(emptyCandidateForm);
  const [candidateFeedback, setCandidateFeedback] = useState<string | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [documentFeedback, setDocumentFeedback] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isCreatingCandidate, setIsCreatingCandidate] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = useState(false);

  async function refreshJob(token: string) {
    const [detail, review] = await Promise.all([
      fetchRecruiterJobDetail(token, jobId),
      fetchRecruiterJobReview(token, jobId),
    ]);
    setData({ detail, review });
  }

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    Promise.all([
      fetchRecruiterJobDetail(accessToken, jobId),
      fetchRecruiterJobReview(accessToken, jobId),
    ])
      .then(([detail, review]) => {
        setData({ detail, review });
        setLoadError(null);
      })
      .catch((caughtError) => {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter job.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isRecruiterSession, jobId]);

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open recruiter jobs"
        message="Open a recruiter account to manage job scope, candidate intake, and evidence-backed review."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter job unavailable"
        message="This page is only available to recruiter accounts."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Job detail request failed" message={loadError} actionHref="/recruiter/jobs" actionLabel="Back to jobs" />;
  }

  if (!data) {
    return <EmptyState title="Job not found" message="We could not load this job. It may have been removed or you may not have access to it." actionHref="/recruiter/jobs" actionLabel="Back to jobs" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Recruiter job detail</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{data.detail.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href={`/recruiter/jobs/${jobId}/comparison`}>
            Compare candidates
          </Link>
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href={`/recruiter/jobs/${jobId}/edit`}>
            Edit job
          </Link>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--color-danger)]"
            disabled={isDeletingJob}
            onClick={() => {
              setIsDeleteDialogOpen(true);
            }}
          >
            {isDeletingJob ? "Deleting..." : "Delete job"}
          </button>
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href="/recruiter/jobs">
            Back to jobs
          </Link>
        </div>
      </div>

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        eyebrow="Delete recruiter job"
        title={`Delete ${data.detail.title}?`}
        description="This removes the job, every candidate under it, recruiter-side documents, saved recruiter reports, and associated vectors. This action cannot be undone."
        confirmLabel="Delete job"
        isConfirming={isDeletingJob}
        onClose={() => {
          if (isDeletingJob) {
            return;
          }
          setIsDeleteDialogOpen(false);
        }}
        onConfirm={() => {
          if (!accessToken) {
            return;
          }

          setIsDeletingJob(true);
          void deleteRecruiterJob(accessToken, jobId)
            .then(() => {
              setIsDeleteDialogOpen(false);
              router.push("/recruiter/jobs");
            })
            .catch((caughtError) => {
              setLoadError(caughtError instanceof Error ? caughtError.message : "Could not delete recruiter job.");
              setIsDeletingJob(false);
            });
        }}
      />

      <RecruiterCandidateCreateDialog
        open={isCandidateDialogOpen}
        form={candidateForm}
        error={candidateError}
        isSubmitting={isCreatingCandidate}
        onChange={(updater) => setCandidateForm((current) => updater(current))}
        onClose={() => {
          if (isCreatingCandidate) {
            return;
          }
          setIsCandidateDialogOpen(false);
        }}
        onSubmit={(form) => {
          if (!accessToken) {
            return;
          }

          const formData = new FormData(form);
          const candidateCvFile = formData.get("candidate_cv");

          setIsCreatingCandidate(true);
          setCandidateError(null);
          setCandidateFeedback(null);

          void createRecruiterCandidate(accessToken, jobId, buildCandidatePayload(candidateForm))
            .then(async (candidate) => {
              const hasCandidateCv = candidateCvFile instanceof File && candidateCvFile.size > 0;
              if (hasCandidateCv) {
                await uploadRecruiterCandidateDocument(accessToken, jobId, candidate.id, {
                  documentType: "recruiter_candidate_cv",
                  file: candidateCvFile,
                });
              }
              setCandidateForm(emptyCandidateForm);
              form.reset();
              setIsCandidateDialogOpen(false);
              setCandidateFeedback(
                hasCandidateCv
                  ? `${candidate.full_name} added to this job with the candidate CV uploaded.`
                  : `${candidate.full_name} added to this job.`,
              );
              await refreshJob(accessToken);
            })
            .catch((caughtError) => {
              setCandidateError(caughtError instanceof Error ? caughtError.message : "Could not add recruiter candidate.");
            })
            .finally(() => setIsCreatingCandidate(false));
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Job summary</CardTitle>
            <CardDescription>Review the role scope, required skills, and current hiring activity for this job.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-7 text-[var(--color-ink-muted)]">{data.detail.description}</p>
            <div className="flex flex-wrap gap-2">
              {data.detail.seniority ? <Badge>{data.detail.seniority}</Badge> : null}
              {data.detail.location ? <Badge>{data.detail.location}</Badge> : null}
              <Badge>{`${data.review.job_document_count} job docs`}</Badge>
              <Badge>{`${data.review.candidate_count} candidates`}</Badge>
              <Badge>{`${data.review.report_count} reports`}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.detail.skills_required.length ? (
                data.detail.skills_required.map((skill) => <Badge key={skill}>{skill}</Badge>)
              ) : (
                <p className="text-sm text-[var(--color-ink-muted)]">No required skills saved yet.</p>
              )}
            </div>
            <p className="text-sm text-[var(--color-ink-soft)]">{`Updated ${formatDateTime(data.detail.updated_at)}`}</p>
            {data.review.latest_report_title ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
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
            <CardTitle>Source job brief</CardTitle>
            <CardDescription>
              Optional but recommended. Upload the full job description or hiring brief so recruiter reports can quote and ground themselves in the original role document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm leading-6 text-[var(--color-ink-muted)]">
              <p>
                The job title, summary, seniority, location, and skills you entered already define the job record.
              </p>
              <p className="mt-2">
                This upload is a separate source document for evidence-backed fit summaries and interview packs.
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!accessToken) {
                  return;
                }

                const form = event.currentTarget;
                const formData = new FormData(form);
                const file = formData.get("job_file");
                if (!(file instanceof File) || !file.size) {
                  setDocumentError("Choose a job description file before uploading.");
                  return;
                }

                setIsUploadingDocument(true);
                setDocumentError(null);
                setDocumentFeedback(null);

                void uploadRecruiterJobDocument(accessToken, jobId, { file })
                  .then(async () => {
                    setDocumentFeedback("Job description uploaded.");
                    form.reset();
                    await refreshJob(accessToken);
                  })
                  .catch((caughtError) => {
                    setDocumentError(caughtError instanceof Error ? caughtError.message : "Could not upload job description.");
                  })
                  .finally(() => setIsUploadingDocument(false));
              }}
            >
              <Input name="job_file" type="file" accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" required />
              {documentError ? <p className="text-sm text-[var(--color-danger)]">{documentError}</p> : null}
              {documentFeedback ? <p className="text-sm text-[var(--color-teal)]">{documentFeedback}</p> : null}
              <Button type="submit" disabled={isUploadingDocument}>
                {isUploadingDocument ? "Uploading..." : "Upload job brief"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Candidate intake</CardTitle>
            <CardDescription>Create a scoped candidate under this job, then upload more recruiter-side evidence when needed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
              Add a candidate only when you are ready to attach them to this specific role. The candidate modal can also upload the CV immediately.
            </p>
            {candidateFeedback ? (
              <div className="rounded-2xl border border-[rgba(15,123,76,0.18)] bg-[rgba(15,123,76,0.08)] px-4 py-3 text-sm font-medium text-[var(--color-teal)]">
                {candidateFeedback}
              </div>
            ) : null}
            {candidateError ? <p className="text-sm text-[var(--color-danger)]">{candidateError}</p> : null}
            <Button
              type="button"
              onClick={() => {
                setCandidateError(null);
                setIsCandidateDialogOpen(true);
              }}
            >
              Add candidate
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate list</CardTitle>
            <CardDescription>Each candidate card shows shortlist status, report counts, and quick access to uploads and review details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.review.candidates.length ? (
              <Link
                href={`/recruiter/jobs/${jobId}/comparison`}
                className="block rounded-[28px] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-4 text-sm font-semibold text-[var(--color-accent)]"
              >
                Open comparison workflow
              </Link>
            ) : null}
            {data.review.candidates.length ? (
              data.review.candidates.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/recruiter/jobs/${jobId}/candidates/${candidate.id}`}
                  className="block rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-5 transition-colors hover:bg-[var(--color-panel)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">{candidate.full_name}</p>
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                        {candidate.current_title || "No current title"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{formatLabel(candidate.shortlist_status)}</Badge>
                      <Badge>{`${candidate.document_count} docs`}</Badge>
                      <Badge>{`${candidate.report_count} reports`}</Badge>
                    </div>
                  </div>
                  {candidate.notes ? (
                    <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{candidate.notes}</p>
                  ) : null}
                  {candidate.latest_report_title ? (
                    <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                      {candidate.latest_report_title}
                      {candidate.latest_report_type ? ` · ${formatLabel(candidate.latest_report_type)}` : ""}
                    </p>
                  ) : null}
                </Link>
              ))
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                No candidates attached to this job yet. Use the intake form to create the first one.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRecruiterJob, deleteRecruiterJob, fetchRecruiterJobs } from "@/lib/api/recruiter";
import type { RecruiterJobDetail, RecruiterJobListItem, RecruiterJobPayload } from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils";

type RecruiterJobFormState = {
  title: string;
  description: string;
  seniority: string;
  location: string;
  skills_required: string;
};

const emptyForm: RecruiterJobFormState = {
  title: "",
  description: "",
  seniority: "",
  location: "",
  skills_required: "",
};

function buildPayload(form: RecruiterJobFormState): RecruiterJobPayload {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    seniority: form.seniority.trim() || null,
    location: form.location.trim() || null,
    skills_required: form.skills_required
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function buildCompactSummary(text: string, maxLength = 110) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function CreateJobDialog({
  open,
  form,
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: RecruiterJobFormState;
  error: string | null;
  isSubmitting: boolean;
  onChange: (updater: (current: RecruiterJobFormState) => RecruiterJobFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[150]">
      <button
        type="button"
        aria-label="Close create job dialog"
        className="absolute inset-0 bg-[rgba(14,18,32,0.72)]"
        disabled={isSubmitting}
        onClick={onClose}
      />

      <div className="relative z-[151] flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="w-full max-w-3xl rounded-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_30px_90px_-28px_rgba(27,31,59,0.7)]">
          <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Create recruiter job</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Create a new hiring scope</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-ink-muted)]">
              Save the structured role details first. You can attach the full job brief afterward if you want evidence-backed recruiter analysis.
            </p>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="job-title">
                Title
              </label>
              <Input
                id="job-title"
                value={form.title}
                onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
                placeholder="Senior Platform Engineer"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="job-description">
                Role summary
              </label>
              <Textarea
                id="job-description"
                className="min-h-36"
                value={form.description}
                onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
                placeholder="Summarise the role, responsibilities, and evaluation areas."
                required
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="job-seniority">
                  Seniority
                </label>
                <Input
                  id="job-seniority"
                  value={form.seniority}
                  onChange={(event) => onChange((current) => ({ ...current, seniority: event.target.value }))}
                  placeholder="Senior"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="job-location">
                  Location
                </label>
                <Input
                  id="job-location"
                  value={form.location}
                  onChange={(event) => onChange((current) => ({ ...current, location: event.target.value }))}
                  placeholder="Remote or London"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="job-skills">
                Skills required
              </label>
              <Textarea
                id="job-skills"
                className="min-h-28"
                value={form.skills_required}
                onChange={(event) => onChange((current) => ({ ...current, skills_required: event.target.value }))}
                placeholder={"Python\nFastAPI\nRetrieval systems"}
              />
            </div>

            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Creating job..." : "Create job"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CompactJobCard({
  job,
  deleting,
  onDelete,
}: {
  job: RecruiterJobListItem;
  deleting: boolean;
  onDelete: (job: RecruiterJobListItem) => void;
}) {
  return (
    <div className="group relative">
      <Link
        href={`/recruiter/jobs/${job.id}`}
        className="block rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-38px_rgba(27,31,59,0.45)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">{job.title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{buildCompactSummary(job.description)}</p>
          </div>
          <span className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]">
            Open
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {job.seniority ? <Badge>{job.seniority}</Badge> : null}
          {job.location ? <Badge>{job.location}</Badge> : null}
          <Badge>{`${job.candidate_count} candidates`}</Badge>
          <Badge>{`${job.linked_document_count} job docs`}</Badge>
        </div>

        {job.skills_required.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {job.skills_required.slice(0, 3).map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
            {job.skills_required.length > 3 ? <Badge>{`+${job.skills_required.length - 3} more`}</Badge> : null}
          </div>
        ) : null}

        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">{`Updated ${formatDateTime(job.updated_at)}`}</p>
      </Link>

      <div className="pointer-events-none absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Link
          href={`/recruiter/jobs/${job.id}/edit`}
          className="pointer-events-auto rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
          onClick={(event) => event.stopPropagation()}
        >
          Edit
        </Link>
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--color-danger)] ring-1 ring-[rgba(190,32,63,0.18)]"
          disabled={deleting}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(job);
          }}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

export function RecruiterJobsPage() {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [jobs, setJobs] = useState<RecruiterJobListItem[]>([]);
  const [form, setForm] = useState<RecruiterJobFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<RecruiterJobDetail | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null);
  const [jobPendingDelete, setJobPendingDelete] = useState<RecruiterJobListItem | null>(null);

  async function refreshJobs(token: string) {
    const payload = await fetchRecruiterJobs(token);
    setJobs(payload.items);
  }

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    fetchRecruiterJobs(accessToken)
      .then((payload) => {
        setJobs(payload.items);
        setLoadError(null);
      })
      .catch((caughtError) => {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter jobs.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isRecruiterSession]);

  async function handleCreateJob() {
    if (!accessToken) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccess(null);

    try {
      const job = await createRecruiterJob(accessToken, buildPayload(form));
      setCreatedJob(job);
      setForm(emptyForm);
      setIsCreateDialogOpen(false);
      setSuccess(`Created ${job.title}.`);
      await refreshJobs(accessToken);
    } catch (caughtError) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : "Could not create recruiter job.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to manage recruiter jobs"
        message="Open the recruiter workspace to create roles, add candidates, and manage hiring scopes."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter jobs unavailable"
        message="This page is only available to recruiter accounts."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Jobs request failed" message={loadError} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Recruiter jobs</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">Manage roles and candidate pipelines</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">
              Create separate jobs, open each role for full details, add candidates under the right scope, and compare them role by role.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                setSubmitError(null);
                setIsCreateDialogOpen(true);
              }}
            >
              Create job
            </Button>
            <Link
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--color-panel)] px-5 text-sm font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)] sm:w-auto"
              href="/recruiter/setup"
            >
              Open recruiter setup
            </Link>
          </div>
        </CardContent>
      </Card>

      {success ? (
        <div className="rounded-[28px] border border-[rgba(15,123,76,0.18)] bg-[rgba(15,123,76,0.08)] px-5 py-4 text-sm font-medium text-[var(--color-teal)]">
          {success}
          {createdJob ? (
            <Link className="ml-2 font-semibold text-[var(--color-teal)] underline-offset-4 hover:underline" href={`/recruiter/jobs/${createdJob.id}`}>
              Open job
            </Link>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Live recruiter jobs</CardTitle>
          <CardDescription>Click a job card to open the full role detail page. Use the hover actions only when you need to edit or remove a role.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {jobs.map((job) => (
                <CompactJobCard
                  key={job.id}
                  job={job}
                  deleting={deletingJobId === job.id}
                  onDelete={(selectedJob) => {
                    setSubmitError(null);
                    setJobPendingDelete(selectedJob);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-10 text-center">
              <p className="text-sm font-medium text-[var(--color-ink)]">No recruiter jobs yet</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                Create the first job to start candidate intake and role-based comparison.
              </p>
              <Button
                type="button"
                className="mt-5"
                onClick={() => {
                  setSubmitError(null);
                  setIsCreateDialogOpen(true);
                }}
              >
                Create first job
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateJobDialog
        open={isCreateDialogOpen}
        form={form}
        error={submitError}
        isSubmitting={isSubmitting}
        onChange={(updater) => setForm((current) => updater(current))}
        onClose={() => {
          if (isSubmitting) {
            return;
          }
          setIsCreateDialogOpen(false);
        }}
        onSubmit={() => void handleCreateJob()}
      />

      <ConfirmationDialog
        open={jobPendingDelete !== null}
        eyebrow="Delete recruiter job"
        title={jobPendingDelete ? `Delete ${jobPendingDelete.title}?` : "Delete job?"}
        description="This removes the job, its scoped candidates, recruiter-side documents, saved recruiter reports, and associated vectors. This action cannot be undone."
        confirmLabel="Delete job"
        isConfirming={jobPendingDelete !== null && deletingJobId === jobPendingDelete.id}
        onClose={() => {
          if (deletingJobId !== null) {
            return;
          }
          setJobPendingDelete(null);
        }}
        onConfirm={() => {
          if (!accessToken || !jobPendingDelete) {
            return;
          }

          setDeletingJobId(jobPendingDelete.id);
          setSubmitError(null);
          setSuccess(null);

          void deleteRecruiterJob(accessToken, jobPendingDelete.id)
            .then(async () => {
              setCreatedJob((current) => (current?.id === jobPendingDelete.id ? null : current));
              setSuccess(`Deleted ${jobPendingDelete.title}.`);
              setJobPendingDelete(null);
              await refreshJobs(accessToken);
            })
            .catch((caughtError) => {
              setSubmitError(caughtError instanceof Error ? caughtError.message : "Could not delete recruiter job.");
            })
            .finally(() => setDeletingJobId(null));
        }}
      />
    </div>
  );
}

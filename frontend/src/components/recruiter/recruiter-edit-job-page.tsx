"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchRecruiterJobDetail, updateRecruiterJob } from "@/lib/api/recruiter";
import type { RecruiterJobDetail, RecruiterJobPayload } from "@/lib/api/types";

type RecruiterJobFormState = {
  title: string;
  description: string;
  seniority: string;
  location: string;
  skills_required: string;
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

function buildFormState(job: RecruiterJobDetail): RecruiterJobFormState {
  return {
    title: job.title,
    description: job.description,
    seniority: job.seniority ?? "",
    location: job.location ?? "",
    skills_required: job.skills_required.join("\n"),
  };
}

export function RecruiterEditJobPage({ jobId }: { jobId: number }) {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [job, setJob] = useState<RecruiterJobDetail | null>(null);
  const [form, setForm] = useState<RecruiterJobFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    fetchRecruiterJobDetail(accessToken, jobId)
      .then((payload) => {
        setJob(payload);
        setForm(buildFormState(payload));
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
        title="Sign in to edit recruiter jobs"
        message="This page updates an existing recruiter job via the live recruiter management API."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter job edit unavailable"
        message="This route expects a recruiter account."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Job edit request failed" message={loadError} actionHref="/recruiter/jobs" actionLabel="Back to jobs" />;
  }

  if (!job || !form) {
    return <EmptyState title="Job not found" message="The recruiter job could not be loaded for editing." actionHref="/recruiter/jobs" actionLabel="Back to jobs" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Edit recruiter job</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{job.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href={`/recruiter/jobs/${jobId}`}>
            Back to job detail
          </Link>
          <Link className="text-sm font-semibold text-[var(--color-accent)]" href="/recruiter/jobs">
            Back to jobs
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Edit job details</CardTitle>
            <CardDescription>Update the recruiter-side role scope before running new uploads, analysis, or report generation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!accessToken) {
                  return;
                }

                setIsSubmitting(true);
                setSubmitError(null);
                setSuccess(null);

                void updateRecruiterJob(accessToken, jobId, buildPayload(form))
                  .then((payload) => {
                    setJob(payload);
                    setForm(buildFormState(payload));
                    setSuccess("Recruiter job updated.");
                  })
                  .catch((caughtError) => {
                    setSubmitError(caughtError instanceof Error ? caughtError.message : "Could not update recruiter job.");
                  })
                  .finally(() => setIsSubmitting(false));
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="edit-job-title">
                  Title
                </label>
                <Input
                  id="edit-job-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => (current ? { ...current, title: event.target.value } : current))}
                  placeholder="Senior Platform Engineer"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="edit-job-description">
                  Description
                </label>
                <Textarea
                  id="edit-job-description"
                  className="min-h-36"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => (current ? { ...current, description: event.target.value } : current))
                  }
                  placeholder="Describe the role, responsibilities, and core evaluation areas."
                  required
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="edit-job-seniority">
                    Seniority
                  </label>
                  <Input
                    id="edit-job-seniority"
                    value={form.seniority}
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, seniority: event.target.value } : current))
                    }
                    placeholder="Senior"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="edit-job-location">
                    Location
                  </label>
                  <Input
                    id="edit-job-location"
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, location: event.target.value } : current))
                    }
                    placeholder="Remote or London"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="edit-job-skills">
                  Skills required
                </label>
                <Textarea
                  id="edit-job-skills"
                  className="min-h-28"
                  value={form.skills_required}
                  onChange={(event) =>
                    setForm((current) => (current ? { ...current, skills_required: event.target.value } : current))
                  }
                  placeholder={"Python\nFastAPI\nRetrieval systems"}
                />
              </div>

              {submitError ? <p className="text-sm text-[var(--color-danger)]">{submitError}</p> : null}
              {success ? <p className="text-sm text-[var(--color-teal)]">{success}</p> : null}

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving changes..." : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current scope</CardTitle>
            <CardDescription>Editing the job updates the role context that candidate review and recruiter reports rely on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--color-ink-muted)]">
            <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-4">
              <p className="font-semibold text-[var(--color-ink)]">{job.title}</p>
              <p className="mt-2 leading-6">{job.description}</p>
            </div>
            <p>{`${job.candidate_count} candidates and ${job.linked_document_count} linked job documents currently depend on this scope.`}</p>
            <Link className="inline-flex font-semibold text-[var(--color-accent)]" href={`/recruiter/jobs/${jobId}`}>
              Review job detail
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
import { Textarea } from "@/components/ui/textarea";
import { createRecruiterJob, fetchRecruiterJobs } from "@/lib/api/recruiter";
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

function JobCard({ job }: { job: RecruiterJobListItem }) {
  return (
    <Link
      href={`/recruiter/jobs/${job.id}`}
      className="block rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-5 transition-colors hover:bg-[var(--color-panel)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[var(--color-ink)]">{job.title}</p>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{job.description}</p>
        </div>
        <Badge>{`${job.candidate_count} candidates`}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {job.seniority ? <Badge>{job.seniority}</Badge> : null}
        {job.location ? <Badge>{job.location}</Badge> : null}
        <Badge>{`${job.linked_document_count} job docs`}</Badge>
      </div>
      <p className="mt-4 text-sm text-[var(--color-ink-soft)]">{`Updated ${formatDateTime(job.updated_at)}`}</p>
    </Link>
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

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to manage recruiter jobs"
        message="The recruiter jobs page is wired to the live recruiter management endpoints."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter jobs unavailable"
        message="This route expects a recruiter account."
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
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create recruiter job</CardTitle>
            <CardDescription>Create a scoped job record before adding candidates or recruiter-side documents.</CardDescription>
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

                void createRecruiterJob(accessToken, buildPayload(form))
                  .then(async (job) => {
                    setCreatedJob(job);
                    setForm(emptyForm);
                    setSuccess("Recruiter job created.");
                    await refreshJobs(accessToken);
                  })
                  .catch((caughtError) => {
                    setSubmitError(caughtError instanceof Error ? caughtError.message : "Could not create recruiter job.");
                  })
                  .finally(() => setIsSubmitting(false));
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="job-title">
                  Title
                </label>
                <Input
                  id="job-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Senior Platform Engineer"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="job-description">
                  Description
                </label>
                <Textarea
                  id="job-description"
                  className="min-h-36"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Describe the role, responsibilities, and core evaluation areas."
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
                    onChange={(event) => setForm((current) => ({ ...current, seniority: event.target.value }))}
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
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
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
                  onChange={(event) => setForm((current) => ({ ...current, skills_required: event.target.value }))}
                  placeholder={"Python\nFastAPI\nRetrieval systems"}
                />
              </div>

              {submitError ? <p className="text-sm text-[var(--color-danger)]">{submitError}</p> : null}
              {success ? <p className="text-sm text-[var(--color-teal)]">{success}</p> : null}

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating job..." : "Create job"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live recruiter jobs</CardTitle>
            <CardDescription>Open a job to add candidates, upload scoped documents, and review activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {createdJob ? (
              <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-4">
                <p className="text-sm font-semibold text-[var(--color-ink)]">Latest created job</p>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{createdJob.title}</p>
                <Link
                  className="mt-3 inline-flex text-sm font-semibold text-[var(--color-accent)]"
                  href={`/recruiter/jobs/${createdJob.id}`}
                >
                  Open job detail
                </Link>
              </div>
            ) : null}

            {jobs.length ? (
              jobs.map((job) => <JobCard key={job.id} job={job} />)
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">
                No recruiter jobs yet. Create the first job to start intake and review.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

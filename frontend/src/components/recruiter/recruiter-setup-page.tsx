"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createRecruiterProfile,
  fetchRecruiterDashboard,
  fetchRecruiterJobs,
  fetchRecruiterProfile,
  updateRecruiterProfile,
} from "@/lib/api/recruiter";
import { ApiError } from "@/lib/api/client";
import type {
  RecruiterDashboardSummary,
  RecruiterJobListItem,
  RecruiterProfile,
  RecruiterProfilePayload,
  RecruiterType,
} from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

type RecruiterSetupState = {
  summary: RecruiterDashboardSummary;
  jobs: RecruiterJobListItem[];
  profile: RecruiterProfile | null;
};

type SetupStep = {
  title: string;
  description: string;
  complete: boolean;
  href: string;
  actionLabel: string;
};

type RecruiterProfileFormState = {
  companyName: string;
  recruiterType: RecruiterType;
  organisationSize: string;
};

const recruiterTypeOptions: Array<{ value: RecruiterType; label: string; description: string }> = [
  {
    value: "in_house",
    label: "In-house",
    description: "Internal talent or people team working inside one company.",
  },
  {
    value: "agency",
    label: "Agency",
    description: "External recruiter managing candidates across client roles.",
  },
  {
    value: "hiring_manager",
    label: "Hiring manager",
    description: "Team lead or manager directly running the hiring process.",
  },
];

const emptyProfileForm: RecruiterProfileFormState = {
  companyName: "",
  recruiterType: "in_house",
  organisationSize: "",
};

function hydrateProfileForm(profile: RecruiterProfile): RecruiterProfileFormState {
  return {
    companyName: profile.company_name,
    recruiterType: profile.recruiter_type,
    organisationSize: profile.organisation_size ?? "",
  };
}

function buildProfilePayload(form: RecruiterProfileFormState): RecruiterProfilePayload {
  return {
    company_name: form.companyName.trim(),
    recruiter_type: form.recruiterType,
    organisation_size: form.organisationSize.trim() || null,
  };
}

export function RecruiterSetupPage() {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [data, setData] = useState<RecruiterSetupState | null>(null);
  const [form, setForm] = useState<RecruiterProfileFormState>(emptyProfileForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    Promise.all([
      fetchRecruiterDashboard(accessToken),
      fetchRecruiterJobs(accessToken),
      fetchRecruiterProfile(accessToken).catch((caughtError) => {
        if (caughtError instanceof ApiError && caughtError.status === 404) {
          return null;
        }
        throw caughtError;
      }),
    ])
      .then(([summary, jobs, profile]) => {
        setData({ summary, jobs: jobs.items, profile });
        setForm(profile ? hydrateProfileForm(profile) : emptyProfileForm);
        setProfileExists(profile !== null);
        setLoadError(null);
      })
      .catch((caughtError) => {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter setup.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isRecruiterSession]);

  const profileTitle = useMemo(
    () => (profileExists ? "Update recruiter profile" : "Create recruiter profile"),
    [profileExists],
  );

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Create a recruiter account to start setup"
        message="This guided setup route assumes the recruiter workflow and points you straight into jobs, candidates, and reports."
        actionHref="/recruiter/register"
        actionLabel="Create recruiter account"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter setup unavailable"
        message="This route expects a recruiter account."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Recruiter setup request failed" message={loadError} actionHref="/recruiter" actionLabel="Back to overview" />;
  }

  if (!data) {
    return <EmptyState title="Recruiter setup is not ready" message="The recruiter summary endpoints did not return setup content." />;
  }

  const { summary, jobs, profile } = data;
  const latestJob = jobs[0] ?? null;
  const steps: SetupStep[] = [
    {
      title: "Recruiter account",
      description: "Use a recruiter-scoped account so the dashboard, jobs, and reports stay isolated from candidate flows.",
      complete: true,
      href: "/recruiter",
      actionLabel: "Open overview",
    },
    {
      title: "Recruiter profile",
      description: "Save company metadata and recruiter type so the recruiter workspace has its own persisted identity layer.",
      complete: profileExists,
      href: "/recruiter/setup",
      actionLabel: profileExists ? "Review profile" : "Complete profile",
    },
    {
      title: "Create first job",
      description: "Add a role before attaching job descriptions, candidates, and recruiter-generated reports.",
      complete: summary.jobs_count > 0,
      href: "/recruiter/jobs",
      actionLabel: summary.jobs_count > 0 ? "Manage jobs" : "Create job",
    },
    {
      title: "Attach job scope",
      description: "Upload the recruiter-side job description so retrieval and generation can use role evidence.",
      complete: jobs.some((job) => job.linked_document_count > 0),
      href: latestJob ? `/recruiter/jobs/${latestJob.id}` : "/recruiter/jobs",
      actionLabel: latestJob ? "Open latest job" : "Open jobs",
    },
    {
      title: "Add candidates",
      description: "Create candidate records and attach recruiter-side CV or interview feedback under the correct job.",
      complete: summary.candidate_count > 0,
      href: latestJob ? `/recruiter/jobs/${latestJob.id}` : "/recruiter/jobs",
      actionLabel: summary.candidate_count > 0 ? "Review candidates" : "Add candidate",
    },
    {
      title: "Generate reports",
      description: "Run fit summaries or interview packs after the recruiter evidence scope is in place.",
      complete: summary.report_count > 0,
      href: summary.report_count > 0 ? "/recruiter/reports" : latestJob ? `/recruiter/jobs/${latestJob.id}` : "/recruiter/jobs",
      actionLabel: summary.report_count > 0 ? "Open reports" : "Go to job workflow",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <DashboardCard label="Jobs" value={summary.jobs_count} hint="Current recruiter job scopes." />
        <DashboardCard label="Candidates" value={summary.candidate_count} hint="Recruiter-managed candidate records." />
        <DashboardCard label="Documents" value={summary.candidate_document_count} hint="Recruiter-side evidence attached so far." />
        <DashboardCard label="Reports" value={summary.report_count} hint="Saved recruiter outputs available to review." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{profileTitle}</CardTitle>
            <CardDescription>
              Use this page as the first-run path into recruiter identity, jobs, scoped evidence, and recruiter analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div id="recruiter-profile" className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{user.full_name || user.email}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{user.email}</p>
                </div>
                <Badge>{profileExists ? "Profile saved" : "Profile needed"}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">
                Recruiter setup now persists recruiter-specific company metadata separately from the shared auth user.
              </p>
            </div>

            <form
              className="space-y-5 rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!accessToken) {
                  setError("Your session is missing. Sign in again.");
                  return;
                }

                setError(null);
                setSuccess(null);

                const payload = buildProfilePayload(form);
                startTransition(async () => {
                  try {
                    const nextProfile = profileExists
                      ? await updateRecruiterProfile(accessToken, payload)
                      : await createRecruiterProfile(accessToken, payload);
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            profile: nextProfile,
                          }
                        : current,
                    );
                    setForm(hydrateProfileForm(nextProfile));
                    setProfileExists(true);
                    setSuccess(profileExists ? "Recruiter profile updated." : "Recruiter profile created.");
                  } catch (caughtError) {
                    setError(caughtError instanceof Error ? caughtError.message : "Could not save recruiter profile.");
                  }
                });
              }}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="company_name">
                    Company name
                  </label>
                  <Input
                    id="company_name"
                    value={form.companyName}
                    onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                    placeholder="Acme Hiring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="organisation_size">
                    Organisation size
                  </label>
                  <Input
                    id="organisation_size"
                    value={form.organisationSize}
                    onChange={(event) => setForm((current) => ({ ...current, organisationSize: event.target.value }))}
                    placeholder="50-200 employees"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-ink)]">Recruiter type</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {recruiterTypeOptions.map((option) => {
                    const isActive = form.recruiterType === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, recruiterType: option.value }))}
                        className={
                          isActive
                            ? "rounded-[24px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-4 text-left text-[var(--color-paper)]"
                            : "rounded-[24px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4 text-left text-[var(--color-ink)]"
                        }
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className={isActive ? "mt-2 text-sm text-[var(--color-paper)]/80" : "mt-2 text-sm text-[var(--color-ink-muted)]"}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
              {success ? <p className="text-sm text-[var(--color-teal)]">{success}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving profile..." : profileExists ? "Update recruiter profile" : "Create recruiter profile"}
                </Button>
                {profile ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                    <Badge>{formatLabel(profile.recruiter_type)}</Badge>
                    {profile.organisation_size ? <Badge>{profile.organisation_size}</Badge> : null}
                  </div>
                ) : null}
              </div>
            </form>

            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">{`Step ${index + 1}`}</p>
                    <p className="mt-2 text-base font-semibold text-[var(--color-ink)]">{step.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{step.description}</p>
                  </div>
                  <Badge>{step.complete ? "Complete" : "Next"}</Badge>
                </div>
                <Link className="mt-4 inline-flex text-sm font-semibold text-[var(--color-accent)]" href={step.href}>
                  {step.actionLabel}
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current entry points</CardTitle>
            <CardDescription>Jump directly into the newest recruiter scope without losing the setup context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {profile ? (
              <div className="rounded-2xl bg-[var(--color-panel)] px-4 py-4">
                <p className="font-semibold text-[var(--color-ink)]">{profile.company_name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{formatLabel(profile.recruiter_type)}</Badge>
                  {profile.organisation_size ? <Badge>{profile.organisation_size}</Badge> : null}
                </div>
              </div>
            ) : null}
            <Link className="block rounded-2xl bg-[var(--color-panel)] px-4 py-3 text-[var(--color-ink)]" href="/recruiter/jobs">
              Open recruiter jobs
            </Link>
            <Link className="block rounded-2xl bg-[var(--color-panel)] px-4 py-3 text-[var(--color-ink)]" href="/recruiter/reports">
              Open recruiter reports
            </Link>
            {latestJob ? (
              <>
                <Link className="block rounded-2xl bg-[var(--color-panel)] px-4 py-3 text-[var(--color-ink)]" href={`/recruiter/jobs/${latestJob.id}`}>
                  Open latest job
                </Link>
                <Link className="block rounded-2xl bg-[var(--color-panel)] px-4 py-3 text-[var(--color-ink)]" href={`/recruiter/jobs/${latestJob.id}/edit`}>
                  Edit latest job
                </Link>
              </>
            ) : null}
            <p className="text-[var(--color-ink-muted)]">
              {latestJob
                ? `Latest job: ${latestJob.title}`
                : "No recruiter job exists yet. Start with the create-job form to unlock the rest of the recruiter flow."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

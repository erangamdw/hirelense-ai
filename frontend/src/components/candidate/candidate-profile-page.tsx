"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCandidateProfile,
  fetchCandidateProfile,
  updateCandidateProfile,
} from "@/lib/api/candidate";
import { ApiError } from "@/lib/api/client";
import type { CandidateProfilePayload } from "@/lib/api/types";

type ProfileFormState = {
  headline: string;
  bio: string;
  location: string;
  years_experience: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  target_roles: string;
};

const emptyForm: ProfileFormState = {
  headline: "",
  bio: "",
  location: "",
  years_experience: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  target_roles: "",
};

function buildPayload(form: ProfileFormState): CandidateProfilePayload {
  return {
    headline: form.headline.trim() || null,
    bio: form.bio.trim() || null,
    location: form.location.trim() || null,
    years_experience: form.years_experience.trim() ? Number(form.years_experience) : null,
    linkedin_url: form.linkedin_url.trim() || null,
    github_url: form.github_url.trim() || null,
    portfolio_url: form.portfolio_url.trim() || null,
    target_roles: form.target_roles
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function hydrateForm(payload: CandidateProfilePayload): ProfileFormState {
  return {
    headline: payload.headline ?? "",
    bio: payload.bio ?? "",
    location: payload.location ?? "",
    years_experience:
      payload.years_experience === null || payload.years_experience === undefined
        ? ""
        : String(payload.years_experience),
    linkedin_url: payload.linkedin_url ?? "",
    github_url: payload.github_url ?? "",
    portfolio_url: payload.portfolio_url ?? "",
    target_roles: payload.target_roles.join("\n"),
  };
}

export function CandidateProfilePage() {
  const { accessToken, status, user } = useAuth();
  const isCandidateSession = status === "authenticated" && !!accessToken && user?.role === "candidate";
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isCandidateSession || !accessToken) {
      return;
    }

    fetchCandidateProfile(accessToken)
      .then((profile) => {
        setForm(hydrateForm(profile));
        setProfileExists(true);
        setLoadError(null);
      })
      .catch((caughtError) => {
        if (caughtError instanceof ApiError && caughtError.status === 404) {
          setForm(emptyForm);
          setProfileExists(false);
          setLoadError(null);
          return;
        }
        setLoadError(caughtError instanceof Error ? caughtError.message : "Could not load candidate profile.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isCandidateSession]);

  const title = useMemo(
    () => (profileExists ? "Update candidate profile" : "Create candidate profile"),
    [profileExists],
  );

  if (status === "loading" || (isCandidateSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to manage your candidate profile"
        message="The candidate profile form is wired to the live backend profile API."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate profile unavailable"
        message="This route expects a candidate account."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Profile request failed" message={loadError} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Keep target roles, links, and core context aligned with the backend candidate profile record.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!accessToken) {
              setError("Your session is missing. Sign in again.");
              return;
            }

            setError(null);
            setSuccess(null);

            const payload = buildPayload(form);
            startTransition(async () => {
              try {
                const nextProfile = profileExists
                  ? await updateCandidateProfile(accessToken, payload)
                  : await createCandidateProfile(accessToken, payload);
                setForm(hydrateForm(nextProfile));
                setProfileExists(true);
                setSuccess(profileExists ? "Profile updated." : "Profile created.");
              } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : "Could not save profile.");
              }
            });
          }}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="headline">
                Headline
              </label>
              <Input
                id="headline"
                value={form.headline}
                onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))}
                placeholder="Senior platform engineer"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="location">
                Location
              </label>
              <Input
                id="location"
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="London or remote"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="years_experience">
                Years of experience
              </label>
              <Input
                id="years_experience"
                type="number"
                min={0}
                max={80}
                value={form.years_experience}
                onChange={(event) => setForm((current) => ({ ...current, years_experience: event.target.value }))}
                placeholder="6"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="linkedin_url">
                LinkedIn URL
              </label>
              <Input
                id="linkedin_url"
                value={form.linkedin_url}
                onChange={(event) => setForm((current) => ({ ...current, linkedin_url: event.target.value }))}
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="github_url">
                GitHub URL
              </label>
              <Input
                id="github_url"
                value={form.github_url}
                onChange={(event) => setForm((current) => ({ ...current, github_url: event.target.value }))}
                placeholder="https://github.com/..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="portfolio_url">
                Portfolio URL
              </label>
              <Input
                id="portfolio_url"
                value={form.portfolio_url}
                onChange={(event) => setForm((current) => ({ ...current, portfolio_url: event.target.value }))}
                placeholder="https://portfolio.example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="bio">
              Bio
            </label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              placeholder="Summarise your experience, focus areas, and strengths."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="target_roles">
              Target roles
            </label>
            <Textarea
              id="target_roles"
              className="min-h-28"
              value={form.target_roles}
              onChange={(event) => setForm((current) => ({ ...current, target_roles: event.target.value }))}
              placeholder={"Platform Engineer\nBackend Engineer\nEngineering Manager"}
            />
            <p className="text-sm text-[var(--color-ink-muted)]">Use one role per line or comma-separated values.</p>
          </div>

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          {success ? <p className="text-sm text-[var(--color-teal)]">{success}</p> : null}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving profile..." : profileExists ? "Save changes" : "Create profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

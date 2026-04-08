"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";

import { RecruiterCandidateNav } from "@/components/recruiter/recruiter-candidate-nav";
import { RecruiterEvidenceSidePanel } from "@/components/recruiter/recruiter-evidence-side-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createReport, fetchReportHistory } from "@/lib/api/reports";
import type {
  DocumentType,
  RecruiterGeneratedReportBase,
  RecruiterGenerationPayload,
  ReportType,
  SavedReportListItem,
} from "@/lib/api/types";
import { formatDateTime, formatLabel } from "@/lib/utils";

const recruiterDocumentTypeOptions: Array<{
  value: Extract<DocumentType, "job_description" | "recruiter_candidate_cv" | "interview_feedback">;
  label: string;
}> = [
  { value: "job_description", label: "Job description" },
  { value: "recruiter_candidate_cv", label: "Candidate CV" },
  { value: "interview_feedback", label: "Interview feedback" },
];

function normalizeDocumentTypes(types: DocumentType[]) {
  if (types.length === recruiterDocumentTypeOptions.length) {
    return undefined;
  }
  return types;
}

function toPayloadRecord<T extends RecruiterGeneratedReportBase>(value: T): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export function RecruiterCitationLinks({ chunkIds }: { chunkIds: number[] }) {
  if (!chunkIds.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">Evidence refs</span>
      {chunkIds.map((chunkId) => (
        <a
          key={chunkId}
          href={`#evidence-${chunkId}`}
          className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
        >
          {`C${chunkId}`}
        </a>
      ))}
    </div>
  );
}

function RecruiterGenerationMetaCard({
  result,
  saveMessage,
}: {
  result: RecruiterGeneratedReportBase;
  saveMessage: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generation metadata</CardTitle>
        <CardDescription>Model settings and scoped retrieval metadata returned by the backend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[var(--color-ink-muted)]">
        <div className="flex flex-wrap gap-2">
          <Badge>{result.provider}</Badge>
          <Badge>{result.model}</Badge>
          <Badge>{`${result.evidence_count} evidence chunks`}</Badge>
        </div>
        <p>{`Temperature ${result.temperature} · Max output tokens ${result.max_output_tokens}`}</p>
        <div className="flex flex-wrap gap-2">
          {result.applied_document_types.length ? (
            result.applied_document_types.map((item) => <Badge key={item}>{formatLabel(item)}</Badge>)
          ) : (
            <p>No document filter was applied.</p>
          )}
        </div>
        {saveMessage ? <p className="text-[var(--color-teal)]">{saveMessage}</p> : null}
      </CardContent>
    </Card>
  );
}

function ScopedSavedReports({
  items,
}: {
  items: SavedReportListItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Persisted report history</CardTitle>
        <CardDescription>Recent saved recruiter reports for this specific job and candidate scope.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/recruiter/reports/${item.id}`}
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{formatDateTime(item.created_at)}</p>
                </div>
                <Badge>{formatLabel(item.report_type)}</Badge>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No recruiter reports are saved for this scope yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type RecruiterGenerationWorkspaceProps<T extends RecruiterGeneratedReportBase> = {
  jobId: number;
  candidateId: number;
  title: string;
  description: string;
  promptLabel: string;
  promptPlaceholder: string;
  defaultQuery: string;
  generateButtonLabel: string;
  generatingButtonLabel: string;
  emptyResultTitle: string;
  emptyResultMessage: string;
  reportType: ReportType;
  generate: (accessToken: string, payload: RecruiterGenerationPayload) => Promise<T>;
  renderResult: (result: T) => ReactNode;
};

export function RecruiterGenerationWorkspace<T extends RecruiterGeneratedReportBase>({
  jobId,
  candidateId,
  title,
  description,
  promptLabel,
  promptPlaceholder,
  defaultQuery,
  generateButtonLabel,
  generatingButtonLabel,
  emptyResultTitle,
  emptyResultMessage,
  reportType,
  generate,
  renderResult,
}: RecruiterGenerationWorkspaceProps<T>) {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [query, setQuery] = useState(defaultQuery);
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<DocumentType[]>(
    recruiterDocumentTypeOptions.map((item) => item.value),
  );
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportListItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function refreshScopedHistory(token: string) {
    const payload = await fetchReportHistory(token, {
      limit: 5,
      recruiterJobId: jobId,
      recruiterCandidateId: candidateId,
    });
    setSavedReports(payload.items);
  }

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    fetchReportHistory(accessToken, {
      limit: 5,
      recruiterJobId: jobId,
      recruiterCandidateId: candidateId,
    })
      .then((payload) => {
        setSavedReports(payload.items);
      })
      .catch(() => undefined);
  }, [accessToken, candidateId, isRecruiterSession, jobId]);

  function toggleDocumentType(documentType: DocumentType) {
    setSelectedDocumentTypes((current) => {
      if (current.includes(documentType)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((item) => item !== documentType);
      }
      return [...current, documentType];
    });
  }

  async function handleGenerate() {
    if (!accessToken) {
      return;
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3) {
      setError("Enter a prompt with at least 3 characters.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSaveMessage(null);

    try {
      const payload = await generate(accessToken, {
        query: normalizedQuery,
        recruiterJobId: jobId,
        recruiterCandidateId: candidateId,
        documentTypes: normalizeDocumentTypes(selectedDocumentTypes),
      });
      setResult(payload);
      await refreshScopedHistory(accessToken);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not generate recruiter output.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!accessToken || !result) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const report = await createReport(accessToken, {
        reportType,
        query: result.query,
        recruiterJobId: jobId,
        recruiterCandidateId: candidateId,
        payload: toPayloadRecord(result),
      });
      setSaveMessage(`Saved recruiter report #${report.id}.`);
      await refreshScopedHistory(accessToken);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save recruiter report.");
    } finally {
      setIsSaving(false);
    }
  }

  if (status === "loading") {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to use recruiter analysis"
        message="These recruiter analysis pages call the live generation and report APIs."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter analysis unavailable"
        message="This route expects a recruiter account."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (!isRecruiterSession) {
    return <ErrorState title="Recruiter analysis unavailable" message="Your session is not ready yet." />;
  }

  return (
    <div className="space-y-6">
      <RecruiterCandidateNav jobId={jobId} candidateId={candidateId} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="recruiter-generation-query">
                  {promptLabel}
                </label>
                <Textarea
                  id="recruiter-generation-query"
                  className="min-h-36"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={promptPlaceholder}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-ink)]">Document scope</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {recruiterDocumentTypeOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocumentTypes.includes(option.value)}
                        onChange={() => toggleDocumentType(option.value)}
                        className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={isGenerating} onClick={() => void handleGenerate()}>
                  {isGenerating ? generatingButtonLabel : generateButtonLabel}
                </Button>
                <Button type="button" variant="secondary" disabled={isSaving || result === null} onClick={() => void handleSave()}>
                  {isSaving ? "Saving report..." : "Save report"}
                </Button>
                <Link href={`/recruiter/jobs/${jobId}/candidates/${candidateId}`} className="inline-flex h-11 items-center text-sm font-semibold text-[var(--color-accent)]">
                  Back to candidate review
                </Link>
              </div>
            </CardContent>
          </Card>

          {result ? (
            <>
              {renderResult(result)}
              <RecruiterGenerationMetaCard result={result} saveMessage={saveMessage} />
            </>
          ) : (
            <EmptyState title={emptyResultTitle} message={emptyResultMessage} />
          )}

          <ScopedSavedReports items={savedReports} />
        </div>

        <RecruiterEvidenceSidePanel evidence={result?.evidence ?? []} />
      </div>
    </div>
  );
}

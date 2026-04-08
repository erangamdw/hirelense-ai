"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import Link from "next/link";

import { CandidateAssistantNav } from "@/components/candidate/candidate-assistant-nav";
import { CandidateEvidenceSidePanel } from "@/components/candidate/candidate-evidence-side-panel";
import { CandidateEvidenceViewer } from "@/components/candidate/candidate-evidence-viewer";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createReport } from "@/lib/api/reports";
import type {
  CandidateGeneratedReportBase,
  CandidateGenerationPayload,
  DocumentType,
  EvidenceChunk,
  ReportType,
} from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

const documentTypeOptions: Array<{
  value: Extract<DocumentType, "cv" | "job_description" | "project_notes" | "interview_feedback">;
  label: string;
}> = [
  { value: "cv", label: "CV" },
  { value: "job_description", label: "Job description" },
  { value: "project_notes", label: "Project notes" },
  { value: "interview_feedback", label: "Interview feedback" },
];

function normalizeDocumentTypes(types: DocumentType[]) {
  if (types.length === documentTypeOptions.length) {
    return undefined;
  }
  return types;
}

function toPayloadRecord<T extends CandidateGeneratedReportBase>(value: T): Record<string, unknown> {
  return value as Record<string, unknown>;
}

type EvidenceViewerContextValue = {
  canOpenEvidence: boolean;
  openEvidence: (chunkIds: number[]) => void;
};

const EvidenceViewerContext = createContext<EvidenceViewerContextValue | null>(null);

function filterAvailableChunkIds(chunkIds: number[], evidence: EvidenceChunk[]) {
  const availableChunkIds = new Set(evidence.map((item) => item.chunk_id));
  const uniqueChunkIds: number[] = [];

  chunkIds.forEach((chunkId) => {
    if (availableChunkIds.has(chunkId) && !uniqueChunkIds.includes(chunkId)) {
      uniqueChunkIds.push(chunkId);
    }
  });

  return uniqueChunkIds;
}

export function CitationLinks({ chunkIds }: { chunkIds: number[] }) {
  const evidenceViewer = useContext(EvidenceViewerContext);
  const uniqueChunkIds = chunkIds.filter((chunkId, index) => chunkIds.indexOf(chunkId) === index);

  if (!uniqueChunkIds.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">Citations</span>
      {uniqueChunkIds.length > 1 ? (
        <button
          type="button"
          disabled={!evidenceViewer?.canOpenEvidence}
          onClick={() => evidenceViewer?.openEvidence(uniqueChunkIds)}
          className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-semibold text-[var(--color-paper)] transition-colors hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Open all
        </button>
      ) : null}
      {uniqueChunkIds.map((chunkId) => (
        <button
          key={chunkId}
          type="button"
          disabled={!evidenceViewer?.canOpenEvidence}
          onClick={() => evidenceViewer?.openEvidence([chunkId])}
          className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition-colors hover:bg-[var(--color-panel-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {`C${chunkId}`}
        </button>
      ))}
    </div>
  );
}

export function GenerationMetaCard({
  result,
  saveMessage,
}: {
  result: CandidateGeneratedReportBase;
  saveMessage: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generation metadata</CardTitle>
        <CardDescription>Model settings and document scope returned by the backend.</CardDescription>
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

type CandidateGenerationWorkspaceProps<T extends CandidateGeneratedReportBase> = {
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
  generate: (accessToken: string, payload: CandidateGenerationPayload) => Promise<T>;
  renderResult: (result: T) => ReactNode;
};

export function CandidateGenerationWorkspace<T extends CandidateGeneratedReportBase>({
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
}: CandidateGenerationWorkspaceProps<T>) {
  const { accessToken, status, user } = useAuth();
  const isCandidateSession = status === "authenticated" && !!accessToken && user?.role === "candidate";
  const [query, setQuery] = useState(defaultQuery);
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<DocumentType[]>(
    documentTypeOptions.map((item) => item.value),
  );
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewerChunkIds, setViewerChunkIds] = useState<number[]>([]);
  const [activeEvidenceChunkId, setActiveEvidenceChunkId] = useState<number | null>(null);
  const evidence = result?.evidence ?? [];

  useEffect(() => {
    setQuery(defaultQuery);
    setSelectedDocumentTypes(documentTypeOptions.map((item) => item.value));
    setResult(null);
    setError(null);
    setSaveMessage(null);
    setIsGenerating(false);
    setIsSaving(false);
    setViewerChunkIds([]);
    setActiveEvidenceChunkId(null);
  }, [defaultQuery, reportType]);

  useEffect(() => {
    if (!activeEvidenceChunkId) {
      return;
    }

    const currentEvidence = result?.evidence ?? [];
    const activeChunkStillExists = currentEvidence.some((item) => item.chunk_id === activeEvidenceChunkId);
    if (!activeChunkStillExists) {
      setViewerChunkIds([]);
      setActiveEvidenceChunkId(null);
    }
  }, [activeEvidenceChunkId, result]);

  function openEvidence(chunkIds: number[]) {
    const availableChunkIds = filterAvailableChunkIds(chunkIds, evidence);

    if (!availableChunkIds.length) {
      return;
    }

    setViewerChunkIds(availableChunkIds);
    setActiveEvidenceChunkId((current) => (current && availableChunkIds.includes(current) ? current : availableChunkIds[0]));
  }

  function closeEvidenceViewer() {
    setViewerChunkIds([]);
    setActiveEvidenceChunkId(null);
  }

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
    setResult(null);
    closeEvidenceViewer();

    try {
      const payload = await generate(accessToken, {
        query: normalizedQuery,
        documentTypes: normalizeDocumentTypes(selectedDocumentTypes),
      });
      setResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not generate output.");
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
        payload: toPayloadRecord(result),
      });
      setSaveMessage(`Saved to report history as report #${report.id}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save report.");
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
        title="Sign in to use the interview assistant"
        message="These candidate assistant pages call the live generation and report APIs."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate assistant unavailable"
        message="This route expects a candidate account."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (!isCandidateSession) {
    return <ErrorState title="Candidate assistant unavailable" message="Your session is not ready yet." />;
  }

  return (
    <EvidenceViewerContext.Provider value={{ canOpenEvidence: evidence.length > 0, openEvidence }}>
      <div className="space-y-6">
        <CandidateAssistantNav />

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="candidate-generation-query">
                    {promptLabel}
                  </label>
                  <Textarea
                    id="candidate-generation-query"
                    className="min-h-36"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={promptPlaceholder}
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--color-ink)]">Document scope</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {documentTypeOptions.map((option) => (
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
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSaving || result === null}
                    onClick={() => void handleSave()}
                  >
                    {isSaving ? "Saving report..." : "Save report"}
                  </Button>
                  <Link href="/candidate/reports" className="inline-flex h-11 items-center text-sm font-semibold text-[var(--color-accent)]">
                    Open saved reports
                  </Link>
                </div>
              </CardContent>
            </Card>

            {result ? (
              <>
                {renderResult(result)}
                <GenerationMetaCard result={result} saveMessage={saveMessage} />
              </>
            ) : (
              <EmptyState title={emptyResultTitle} message={emptyResultMessage} />
            )}
          </div>

          <CandidateEvidenceSidePanel evidence={evidence} onOpenEvidence={(chunkId) => openEvidence([chunkId])} />
        </div>

        <CandidateEvidenceViewer
          evidence={evidence}
          activeChunkId={activeEvidenceChunkId}
          availableChunkIds={viewerChunkIds}
          onSelectChunk={setActiveEvidenceChunkId}
          onClose={closeEvidenceViewer}
        />
      </div>
    </EvidenceViewerContext.Provider>
  );
}

"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
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
import {
  clearCandidateWorkspaceState,
  readCandidateWorkspaceState,
  readDefaultCandidateJobDescriptionId,
  writeCandidateWorkspaceState,
  writeDefaultCandidateJobDescriptionId,
} from "@/lib/assistant-storage";
import { fetchDocuments } from "@/lib/api/documents";
import { createReport } from "@/lib/api/reports";
import type {
  CandidateDocument,
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

function filterReadyDocuments(documents: CandidateDocument[]) {
  return documents.filter((document) => document.indexing_status === "succeeded");
}

function sortDocumentsByNewest(documents: CandidateDocument[]) {
  return [...documents].sort((left, right) => {
    const leftTime = Date.parse(left.created_at);
    const rightTime = Date.parse(right.created_at);
    return rightTime - leftTime;
  });
}

function deriveDefaultSelectedDocumentIds(documents: CandidateDocument[]) {
  const sortedDocuments = sortDocumentsByNewest(documents);
  const latestJobDescription = sortedDocuments.find((document) => document.document_type === "job_description");

  return sortedDocuments
    .filter((document) => document.document_type !== "job_description" || document.id === latestJobDescription?.id)
    .map((document) => document.id);
}

function deriveSelectedDocumentIdsWithPreferredJobDescription(
  documents: CandidateDocument[],
  preferredJobDescriptionId: number | null,
) {
  const baseSelection = deriveDefaultSelectedDocumentIds(documents);
  if (!preferredJobDescriptionId) {
    return baseSelection;
  }

  const preferredJobDescription = documents.find(
    (document) => document.document_type === "job_description" && document.id === preferredJobDescriptionId,
  );
  if (!preferredJobDescription) {
    return baseSelection;
  }

  const jobDescriptionIds = documents
    .filter((document) => document.document_type === "job_description")
    .map((document) => document.id);

  return [
    ...baseSelection.filter((documentId) => !jobDescriptionIds.includes(documentId)),
    preferredJobDescription.id,
  ];
}

function getScopedAvailableDocuments(
  documents: CandidateDocument[],
  selectedDocumentTypes: DocumentType[],
) {
  return documents.filter((document) => selectedDocumentTypes.includes(document.document_type));
}

function getScopedSelectedDocumentIds(
  selectedDocumentIds: number[],
  documents: CandidateDocument[],
  selectedDocumentTypes: DocumentType[],
) {
  const scopedDocumentIds = new Set(
    getScopedAvailableDocuments(documents, selectedDocumentTypes).map((document) => document.id),
  );

  return selectedDocumentIds.filter((documentId) => scopedDocumentIds.has(documentId));
}

function normalizeDocumentIds(
  selectedDocumentIds: number[],
  documents: CandidateDocument[],
  selectedDocumentTypes: DocumentType[],
) {
  const scopedAvailableDocuments = getScopedAvailableDocuments(documents, selectedDocumentTypes);
  const scopedSelectedDocumentIds = getScopedSelectedDocumentIds(selectedDocumentIds, documents, selectedDocumentTypes);

  if (!scopedAvailableDocuments.length) {
    return undefined;
  }

  if (scopedSelectedDocumentIds.length === scopedAvailableDocuments.length) {
    return undefined;
  }

  return scopedSelectedDocumentIds;
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
          <CardDescription>Model settings and document scope used for this result.</CardDescription>
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
  const [availableDocuments, setAvailableDocuments] = useState<CandidateDocument[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isWorkspaceHydrated, setIsWorkspaceHydrated] = useState(false);
  const [defaultJobDescriptionId, setDefaultJobDescriptionId] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<DocumentType, boolean>>({
    cv: false,
    job_description: false,
    project_notes: false,
    interview_feedback: false,
    recruiter_candidate_cv: false,
  });
  const [viewerChunkIds, setViewerChunkIds] = useState<number[]>([]);
  const [activeEvidenceChunkId, setActiveEvidenceChunkId] = useState<number | null>(null);
  const availableDocumentsRef = useRef<CandidateDocument[]>([]);
  const evidence = result?.evidence ?? [];
  const documentGroups = documentTypeOptions
    .map((option) => ({
      option,
      documents: sortDocumentsByNewest(
        availableDocuments.filter((document) => document.document_type === option.value),
      ),
    }))
    .filter((group) => selectedDocumentTypes.includes(group.option.value));

  useEffect(() => {
    availableDocumentsRef.current = availableDocuments;
  }, [availableDocuments]);

  useEffect(() => {
    if (user?.role !== "candidate") {
      setIsWorkspaceHydrated(false);
      return;
    }

    const storedDefaultJobDescriptionId = readDefaultCandidateJobDescriptionId(user.id);
    setDefaultJobDescriptionId(storedDefaultJobDescriptionId);

    const storedWorkspaceState = readCandidateWorkspaceState<T>(user.id, reportType);
    if (storedWorkspaceState) {
      setQuery(storedWorkspaceState.query);
      setSelectedDocumentTypes(storedWorkspaceState.selectedDocumentTypes);
      setSelectedDocumentIds(storedWorkspaceState.selectedDocumentIds);
      setResult(storedWorkspaceState.result);
    } else {
      setQuery(defaultQuery);
      setSelectedDocumentTypes(documentTypeOptions.map((item) => item.value));
      setSelectedDocumentIds(
        deriveSelectedDocumentIdsWithPreferredJobDescription(
          availableDocumentsRef.current,
          storedDefaultJobDescriptionId,
        ),
      );
      setResult(null);
    }

    setError(null);
    setSaveMessage(null);
    setIsGenerating(false);
    setIsSaving(false);
    setViewerChunkIds([]);
    setActiveEvidenceChunkId(null);
    setIsWorkspaceHydrated(true);
  }, [defaultQuery, reportType, user]);

  useEffect(() => {
    if (!isWorkspaceHydrated || user?.role !== "candidate") {
      return;
    }

    writeCandidateWorkspaceState(user.id, reportType, {
      query,
      selectedDocumentTypes,
      selectedDocumentIds,
      result,
    });
  }, [isWorkspaceHydrated, query, reportType, result, selectedDocumentIds, selectedDocumentTypes, user]);

  useEffect(() => {
    if (!isCandidateSession || !accessToken) {
      setAvailableDocuments([]);
      setSelectedDocumentIds([]);
      setDocumentsError(null);
      setIsLoadingDocuments(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingDocuments(true);
    setDocumentsError(null);

    void fetchDocuments(accessToken, 100)
      .then((documents) => {
        if (isCancelled) {
          return;
        }

        const readyDocuments = filterReadyDocuments(documents);
        setAvailableDocuments(readyDocuments);
        setSelectedDocumentIds((current) => {
          if (!current.length) {
            return deriveSelectedDocumentIdsWithPreferredJobDescription(
              readyDocuments,
              user?.role === "candidate" ? readDefaultCandidateJobDescriptionId(user.id) : null,
            );
          }

          const readyDocumentIds = new Set(readyDocuments.map((document) => document.id));
          const preserved = current.filter((documentId) => readyDocumentIds.has(documentId));
          const defaultDocumentIds = deriveSelectedDocumentIdsWithPreferredJobDescription(
            readyDocuments,
            user?.role === "candidate" ? readDefaultCandidateJobDescriptionId(user.id) : null,
          );
          const newlyAvailable = defaultDocumentIds.filter((documentId) => !preserved.includes(documentId));
          return [...preserved, ...newlyAvailable];
        });
      })
      .catch((caughtError) => {
        if (isCancelled) {
          return;
        }
        setAvailableDocuments([]);
        setSelectedDocumentIds([]);
        setDocumentsError(caughtError instanceof Error ? caughtError.message : "Could not load documents.");
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingDocuments(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accessToken, isCandidateSession, user]);

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

  function toggleDocumentSelection(documentId: number) {
    const targetDocument = availableDocuments.find((document) => document.id === documentId);

    setSelectedDocumentIds((current) => {
      if (!targetDocument) {
        return current;
      }

      if (targetDocument.document_type === "job_description") {
        if (current.includes(documentId)) {
          return current.filter((item) => item !== documentId);
        }

        const jobDescriptionIds = availableDocuments
          .filter((document) => document.document_type === "job_description")
          .map((document) => document.id);
        return [...current.filter((item) => !jobDescriptionIds.includes(item)), documentId];
      }

      if (current.includes(documentId)) {
        return current.filter((item) => item !== documentId);
      }
      return [...current, documentId];
    });
  }

  function selectDocumentsForType(documentType: DocumentType, nextChecked: boolean) {
    const typeDocumentIds = sortDocumentsByNewest(
      availableDocuments.filter((document) => document.document_type === documentType),
    ).map((document) => document.id);

    setSelectedDocumentIds((current) => {
      if (nextChecked) {
        if (documentType === "job_description") {
          const latestDocumentId = typeDocumentIds[0];
          if (!latestDocumentId) {
            return current;
          }

          return [
            ...current.filter((documentId) => !typeDocumentIds.includes(documentId)),
            latestDocumentId,
          ];
        }

        const next = [...current];
        typeDocumentIds.forEach((documentId) => {
          if (!next.includes(documentId)) {
            next.push(documentId);
          }
        });
        return next;
      }

      return current.filter((documentId) => !typeDocumentIds.includes(documentId));
    });
  }

  function toggleGroupCollapsed(documentType: DocumentType) {
    setCollapsedGroups((current) => ({
      ...current,
      [documentType]: !current[documentType],
    }));
  }

  function handleSetDefaultJobDescription(documentId: number) {
    if (!user || user.role !== "candidate") {
      return;
    }

    writeDefaultCandidateJobDescriptionId(user.id, documentId);
    setDefaultJobDescriptionId(documentId);
    setSelectedDocumentIds((current) => {
      const jobDescriptionIds = availableDocuments
        .filter((document) => document.document_type === "job_description")
        .map((document) => document.id);
      return [...current.filter((item) => !jobDescriptionIds.includes(item)), documentId];
    });
  }

  function resetWorkspaceState() {
    const preferredJobDescriptionId = user?.role === "candidate" ? readDefaultCandidateJobDescriptionId(user.id) : null;
    setQuery(defaultQuery);
    setSelectedDocumentTypes(documentTypeOptions.map((item) => item.value));
    setSelectedDocumentIds(
      deriveSelectedDocumentIdsWithPreferredJobDescription(availableDocuments, preferredJobDescriptionId),
    );
    setResult(null);
    setError(null);
    setSaveMessage(null);
    setIsGenerating(false);
    setIsSaving(false);
    setViewerChunkIds([]);
    setActiveEvidenceChunkId(null);

    if (user?.role === "candidate") {
      clearCandidateWorkspaceState(user.id, reportType);
    }
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

    const scopedAvailableDocuments = getScopedAvailableDocuments(availableDocuments, selectedDocumentTypes);
    const scopedSelectedDocumentIds = getScopedSelectedDocumentIds(
      selectedDocumentIds,
      availableDocuments,
      selectedDocumentTypes,
    );
    if (scopedAvailableDocuments.length > 0 && scopedSelectedDocumentIds.length === 0) {
      setError("Select at least one uploaded document for the current scope before generating.");
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
        documentIds: normalizeDocumentIds(selectedDocumentIds, availableDocuments, selectedDocumentTypes),
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
        message="Open your candidate account to generate interview questions, answer guidance, STAR drafts, and skill-gap insights."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate assistant unavailable"
        message="This page is only available to candidate accounts."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (!isCandidateSession) {
    return <ErrorState title="Candidate assistant unavailable" message="Your session is not ready yet. Please refresh or sign in again." />;
  }

  return (
    <EvidenceViewerContext.Provider value={{ canOpenEvidence: evidence.length > 0, openEvidence }}>
      <div className="space-y-6">
        <CandidateAssistantNav />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
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

                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--color-ink)]">Specific documents</p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      Narrow the selected types to exact files when you want role-specific results, especially for job descriptions.
                    </p>
                  </div>

                  {isLoadingDocuments ? (
                    <p className="text-sm text-[var(--color-ink-muted)]">Loading your indexed documents...</p>
                  ) : documentsError ? (
                    <p className="text-sm text-[var(--color-danger)]">{documentsError}</p>
                  ) : availableDocuments.length === 0 ? (
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      No indexed documents are ready yet. Upload, parse, chunk, and reindex a document before using file-level scope.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {documentGroups.map(({ option, documents }) => {
                        if (!documents.length) {
                          return (
                            <div
                              key={option.value}
                              className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm text-[var(--color-ink-muted)]"
                            >
                              {`No indexed ${option.label.toLowerCase()} documents are ready yet.`}
                            </div>
                          );
                        }

                        const selectedCount = documents.filter((document) => selectedDocumentIds.includes(document.id)).length;

                        return (
                          <div
                            key={option.value}
                            className="space-y-3 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => toggleGroupCollapsed(option.value)}
                              >
                                <p className="text-sm font-semibold text-[var(--color-ink)]">{option.label}</p>
                                <p className="text-xs text-[var(--color-ink-muted)]">
                                  {option.value === "job_description"
                                    ? `${selectedCount ? "1 primary file selected" : "No primary file selected"}`
                                    : `${selectedCount} of ${documents.length} selected`}
                                </p>
                              </button>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="h-9 px-3 text-xs"
                                  onClick={() => selectDocumentsForType(option.value, true)}
                                >
                                  {option.value === "job_description" ? "Select latest" : "Use all"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="h-9 px-3 text-xs"
                                  onClick={() => selectDocumentsForType(option.value, false)}
                                >
                                  Clear
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="h-9 px-3 text-xs"
                                  onClick={() => toggleGroupCollapsed(option.value)}
                                >
                                  {collapsedGroups[option.value] ? "Expand" : "Collapse"}
                                </Button>
                              </div>
                            </div>

                            {collapsedGroups[option.value] ? null : (
                              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                {documents.map((document) => (
                                  <label
                                    key={document.id}
                                    className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                                  >
                                    <input
                                      type={option.value === "job_description" ? "radio" : "checkbox"}
                                      name={option.value === "job_description" ? "primary-job-description" : undefined}
                                      checked={selectedDocumentIds.includes(document.id)}
                                      onChange={() => toggleDocumentSelection(document.id)}
                                      className="mt-1 h-4 w-4 border-[var(--color-border)]"
                                    />
                                    <span className="min-w-0 space-y-1">
                                      <span className="flex flex-wrap items-center gap-2">
                                        <span className="block break-words font-medium">{document.original_filename}</span>
                                        {option.value === "job_description" && defaultJobDescriptionId === document.id ? (
                                          <Badge>Default</Badge>
                                        ) : null}
                                      </span>
                                      <span className="block text-xs text-[var(--color-ink-muted)]">{document.created_at.slice(0, 10)}</span>
                                      {option.value === "job_description" ? (
                                        <button
                                          type="button"
                                          className="text-xs font-semibold text-[var(--color-accent)]"
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            handleSetDefaultJobDescription(document.id);
                                          }}
                                        >
                                          {defaultJobDescriptionId === document.id ? "Default job description" : "Set as default"}
                                        </button>
                                      ) : null}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="button" disabled={isGenerating} onClick={() => void handleGenerate()}>
                    {isGenerating ? generatingButtonLabel : generateButtonLabel}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetWorkspaceState}>
                    Reset
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

            <div className="space-y-6 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto xl:pr-2">
              {result ? (
                <>
                  {renderResult(result)}
                  <GenerationMetaCard result={result} saveMessage={saveMessage} />
                </>
              ) : (
                <EmptyState title={emptyResultTitle} message={emptyResultMessage} />
              )}
            </div>
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

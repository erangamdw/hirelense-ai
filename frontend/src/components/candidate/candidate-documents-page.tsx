"use client";

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
import {
  chunkDocument,
  createTextDocument,
  fetchDocuments,
  parseDocument,
  reindexDocument,
  uploadDocument,
} from "@/lib/api/documents";
import type {
  CandidateDocument,
  DocumentType,
} from "@/lib/api/types";
import { formatBytes, formatDateTime, formatLabel } from "@/lib/utils";

type UploadKind = "cv" | "job_description" | "supporting";

function buildDocumentStatus(document: CandidateDocument) {
  if (document.indexing_status === "succeeded") {
    return "ready";
  }
  if (document.indexing_status === "failed") {
    return "index failed";
  }
  if (document.parsing_status === "failed") {
    return "parse failed";
  }
  if (document.parsing_status === "succeeded") {
    return "parsed";
  }
  return "pending";
}

export function CandidateDocumentsPage() {
  const { accessToken, status, user } = useAuth();
  const isCandidateSession = status === "authenticated" && !!accessToken && user?.role === "candidate";
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeUpload, setActiveUpload] = useState<UploadKind | null>(null);
  const [supportingType, setSupportingType] = useState<Extract<DocumentType, "project_notes" | "interview_feedback">>("project_notes");

  async function loadDocuments(token: string) {
    const payload = await fetchDocuments(token, 20);
    setDocuments(payload);
    return payload;
  }

  useEffect(() => {
    if (!isCandidateSession || !accessToken) {
      return;
    }

    loadDocuments(accessToken)
      .then(() => setLoadError(null))
      .catch((caughtError) => {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Could not load documents.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isCandidateSession]);

  async function processDocument(token: string, documentId: number) {
    await parseDocument(token, documentId);
    await chunkDocument(token, documentId);
    await reindexDocument(token, documentId);
  }

  async function runUpload(
    kind: UploadKind,
    task: () => Promise<number>,
    successMessage: string,
    onSuccessReset?: () => void,
  ) {
    if (!accessToken) {
      return;
    }

    setActiveUpload(kind);
    setFeedback(null);
    setError(null);

    try {
      const documentId = await task();
      await processDocument(accessToken, documentId);
      await loadDocuments(accessToken);
      onSuccessReset?.();
      setFeedback(successMessage);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Document intake failed.");
      if (accessToken) {
        await loadDocuments(accessToken).catch(() => undefined);
      }
    } finally {
      setActiveUpload(null);
    }
  }

  if (status === "loading" || (isCandidateSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to manage candidate documents"
        message="The document intake page uploads files and pasted text into the live backend processing pipeline."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate documents unavailable"
        message="This route expects a candidate account."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (loadError) {
    return <ErrorState title="Document request failed" message={loadError} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>CV upload</CardTitle>
            <CardDescription>Upload a PDF CV and push it through parse, chunk, and index in one action.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                const file = formData.get("cv_file");
                if (!(file instanceof File) || !file.size) {
                  setError("Choose a CV PDF before submitting.");
                  return;
                }

                void runUpload(
                  "cv",
                  async () => {
                    const document = await uploadDocument(accessToken!, {
                      documentType: "cv",
                      file,
                    });
                    return document.id;
                  },
                  "CV uploaded and indexed.",
                  () => form.reset(),
                );
              }}
            >
              <Input name="cv_file" type="file" accept=".pdf,application/pdf" required />
              <Button type="submit" disabled={activeUpload !== null}>
                {activeUpload === "cv" ? "Uploading CV..." : "Upload CV"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job description input</CardTitle>
            <CardDescription>Paste the target role description directly into the backend as a searchable document.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                const title = String(formData.get("title") || "").trim();
                const content = String(formData.get("content") || "").trim();
                if (!content) {
                  setError("Paste a job description before submitting.");
                  return;
                }

                void runUpload(
                  "job_description",
                  async () => {
                    const document = await createTextDocument(accessToken!, {
                      documentType: "job_description",
                      title: title || "job-description",
                      content,
                    });
                    return document.id;
                  },
                  "Job description saved and indexed.",
                  () => form.reset(),
                );
              }}
            >
              <Input name="title" placeholder="platform-engineer-jd" />
              <Textarea
                name="content"
                className="min-h-40"
                placeholder="Paste the job description, requirements, and key signals you want the system to use."
                required
              />
              <Button type="submit" disabled={activeUpload !== null}>
                {activeUpload === "job_description" ? "Saving job description..." : "Save job description"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supporting documents</CardTitle>
          <CardDescription>Add project notes or interview feedback as extra candidate-side context.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-[220px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              const file = formData.get("supporting_file");
              if (!(file instanceof File) || !file.size) {
                setError("Choose a supporting document before submitting.");
                return;
              }

              void runUpload(
                "supporting",
                async () => {
                  const document = await uploadDocument(accessToken!, {
                    documentType: supportingType,
                    file,
                  });
                  return document.id;
                },
                `${formatLabel(supportingType)} uploaded and indexed.`,
                () => form.reset(),
              );
            }}
          >
            <select
              value={supportingType}
              onChange={(event) => {
                setSupportingType(event.target.value as Extract<DocumentType, "project_notes" | "interview_feedback">);
              }}
              className="flex h-11 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-4 focus:ring-[var(--color-ring)]"
            >
              <option value="project_notes">Project notes</option>
              <option value="interview_feedback">Interview feedback</option>
            </select>
            <Input name="supporting_file" type="file" accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" required />
            <Button type="submit" disabled={activeUpload !== null}>
              {activeUpload === "supporting" ? "Uploading..." : "Upload"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {feedback ? <p className="text-sm text-[var(--color-teal)]">{feedback}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Uploaded documents</CardTitle>
          <CardDescription>The list below is loaded from the live `/documents` endpoint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length ? (
            documents.map((document) => (
              <div
                key={document.id}
                className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{document.original_filename}</p>
                    <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                      {formatLabel(document.document_type)} · {formatBytes(document.size_bytes)} · {formatDateTime(document.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{buildDocumentStatus(document)}</Badge>
                    <Badge>{document.parsing_status}</Badge>
                    <Badge>{document.indexing_status}</Badge>
                  </div>
                </div>
                {document.parsing_error ? (
                  <p className="mt-3 text-sm text-[var(--color-danger)]">{document.parsing_error}</p>
                ) : null}
                {document.indexing_error ? (
                  <p className="mt-3 text-sm text-[var(--color-danger)]">{document.indexing_error}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">
              No documents yet. Use one of the intake forms above to create the first candidate context set.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

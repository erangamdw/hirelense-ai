"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchReportDetail } from "@/lib/api/reports";
import type { ReportType, SavedReport } from "@/lib/api/types";
import { formatDateTime, formatLabel } from "@/lib/utils";

type EvidenceItem = {
  chunk_id: number;
  source_label?: string;
  document_type?: string;
  section_title?: string | null;
  page_number?: number | null;
  score_note?: string;
};

type FitSummaryStrength = {
  title: string;
  summary: string;
  evidence_chunk_ids: number[];
};

type InterviewProbe = {
  category: string;
  prompt: string;
  rationale: string;
  evidence_chunk_ids: number[];
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function extractEvidenceItems(payload: Record<string, unknown>): EvidenceItem[] {
  const evidence = payload.evidence;
  if (!Array.isArray(evidence)) {
    return [];
  }

  return evidence.filter(isObjectRecord).map((item) => ({
    chunk_id: typeof item.chunk_id === "number" ? item.chunk_id : 0,
    source_label: typeof item.source_label === "string" ? item.source_label : undefined,
    document_type: typeof item.document_type === "string" ? item.document_type : undefined,
    section_title: typeof item.section_title === "string" ? item.section_title : null,
    page_number: typeof item.page_number === "number" ? item.page_number : null,
    score_note: typeof item.score_note === "string" ? item.score_note : undefined,
  }));
}

function extractStrengthItems(value: unknown): FitSummaryStrength[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObjectRecord)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "Untitled",
      summary: typeof item.summary === "string" ? item.summary : "",
      evidence_chunk_ids: Array.isArray(item.evidence_chunk_ids)
        ? item.evidence_chunk_ids.filter((entry): entry is number => typeof entry === "number")
        : [],
    }));
}

function extractInterviewProbes(value: unknown): InterviewProbe[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObjectRecord)
    .map((item) => ({
      category: typeof item.category === "string" ? item.category : "fit",
      prompt: typeof item.prompt === "string" ? item.prompt : "",
      rationale: typeof item.rationale === "string" ? item.rationale : "",
      evidence_chunk_ids: Array.isArray(item.evidence_chunk_ids)
        ? item.evidence_chunk_ids.filter((entry): entry is number => typeof entry === "number")
        : [],
    }));
}

function CitationLinks({ chunkIds }: { chunkIds: number[] }) {
  if (!chunkIds.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chunkIds.map((chunkId) => (
        <a
          key={chunkId}
          href={`#report-evidence-${chunkId}`}
          className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
        >
          {`C${chunkId}`}
        </a>
      ))}
    </div>
  );
}

function RecruiterFitSummaryView({ payload }: { payload: Record<string, unknown> }) {
  const summary = typeof payload.summary === "string" ? payload.summary : null;
  const strengths = extractStrengthItems(payload.strengths);
  const concerns = extractStrengthItems(payload.concerns);
  const missingEvidenceAreas = isStringArray(payload.missing_evidence_areas) ? payload.missing_evidence_areas : [];
  const recommendation = typeof payload.recommendation === "string" ? payload.recommendation : null;

  return (
    <div className="space-y-6">
      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Fit summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-[var(--color-ink-muted)]">{summary}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {strengths.map((item) => (
              <div key={`${item.title}-${item.summary}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{item.summary}</p>
                <div className="mt-3">
                  <CitationLinks chunkIds={item.evidence_chunk_ids} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Concerns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {concerns.map((item) => (
              <div key={`${item.title}-${item.summary}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{item.summary}</p>
                <div className="mt-3">
                  <CitationLinks chunkIds={item.evidence_chunk_ids} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {missingEvidenceAreas.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Missing evidence areas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingEvidenceAreas.map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                <p className="text-sm text-[var(--color-ink-muted)]">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {recommendation ? (
        <Card>
          <CardHeader>
            <CardTitle>Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-[var(--color-ink-muted)]">{recommendation}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RecruiterInterviewPackView({ payload }: { payload: Record<string, unknown> }) {
  const overview = typeof payload.overview === "string" ? payload.overview : null;
  const probes = extractInterviewProbes(payload.probes);
  const grouped = probes.reduce<Record<string, InterviewProbe[]>>((groups, probe) => {
    const key = probe.category;
    groups[key] = [...(groups[key] || []), probe];
    return groups;
  }, {});
  const followUpQuestions = isStringArray(payload.follow_up_questions) ? payload.follow_up_questions : [];

  return (
    <div className="space-y-6">
      {overview ? (
        <Card>
          <CardHeader>
            <CardTitle>Interview pack overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-[var(--color-ink-muted)]">{overview}</p>
          </CardContent>
        </Card>
      ) : null}

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{formatLabel(category)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((probe, index) => (
              <div key={`${probe.prompt}-${index}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="font-medium text-[var(--color-ink)]">{probe.prompt}</p>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{probe.rationale}</p>
                <div className="mt-3">
                  <CitationLinks chunkIds={probe.evidence_chunk_ids} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {followUpQuestions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Follow-up questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUpQuestions.map((question) => (
              <div key={question} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                <p className="text-sm text-[var(--color-ink-muted)]">{question}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ReportSpecificView({
  reportType,
  payload,
}: {
  reportType: ReportType;
  payload: Record<string, unknown>;
}) {
  if (reportType === "recruiter_fit_summary") {
    return <RecruiterFitSummaryView payload={payload} />;
  }

  if (reportType === "recruiter_interview_pack") {
    return <RecruiterInterviewPackView payload={payload} />;
  }

  return null;
}

export function RecruiterReportDetailPage({ reportId }: { reportId: number }) {
  const { accessToken, status, user } = useAuth();
  const isRecruiterSession = status === "authenticated" && !!accessToken && user?.role === "recruiter";
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecruiterSession || !accessToken) {
      return;
    }

    fetchReportDetail(accessToken, reportId)
      .then((payload) => {
        setReport(payload);
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load recruiter report detail.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isRecruiterSession, reportId]);

  const evidenceItems = useMemo(() => {
    if (!report) {
      return [];
    }
    return extractEvidenceItems(report.payload);
  }, [report]);

  if (status === "loading" || (isRecruiterSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open recruiter report details"
        message="Recruiter report detail pages are backed by the saved reports API."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "recruiter") {
    return (
      <ErrorState
        title="Recruiter report unavailable"
        message="This route expects a recruiter account."
        actionHref="/candidate"
        actionLabel="Open candidate view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Recruiter report detail request failed" message={error} actionHref="/recruiter/reports" actionLabel="Back to reports" />;
  }

  if (!report) {
    return <EmptyState title="Report not found" message="The API did not return a recruiter report for this id." actionHref="/recruiter/reports" actionLabel="Back to reports" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Recruiter report detail</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{report.title}</h2>
        </div>
        <Link className="text-sm font-semibold text-[var(--color-accent)]" href="/recruiter/reports">
          Back to reports
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Report metadata</CardTitle>
            <CardDescription>Core recruiter saved-report fields from the persistence layer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--color-ink-muted)]">
            <div className="flex flex-wrap gap-2">
              <Badge>{formatLabel(report.report_type)}</Badge>
              <Badge>Version {report.payload_version}</Badge>
              {report.recruiter_job_id ? <Badge>{`Job ${report.recruiter_job_id}`}</Badge> : null}
              {report.recruiter_candidate_id ? <Badge>{`Candidate ${report.recruiter_candidate_id}`}</Badge> : null}
            </div>
            <p>Created: {formatDateTime(report.created_at)}</p>
            <p>Owner role: {formatLabel(report.owner_role)}</p>
            <p>Query: {report.query}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export placeholder</CardTitle>
            <CardDescription>Copy the persisted payload JSON for manual review or later export work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                navigator.clipboard
                  .writeText(JSON.stringify(report.payload, null, 2))
                  .then(() => setCopyMessage("Payload copied to clipboard."))
                  .catch(() => setCopyMessage("Clipboard copy was unavailable in this browser."));
              }}
            >
              Copy payload JSON
            </Button>
            {copyMessage ? <p className="text-sm text-[var(--color-ink-muted)]">{copyMessage}</p> : null}
          </CardContent>
        </Card>
      </div>

      <ReportSpecificView reportType={report.report_type} payload={report.payload} />

      {evidenceItems.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Evidence references</CardTitle>
            <CardDescription>Visible citation targets and source labels for the saved recruiter payload.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {evidenceItems.map((item, index) => (
              <div
                id={`report-evidence-${item.chunk_id}`}
                key={`${item.chunk_id}-${index}`}
                className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge>{`C${item.chunk_id}`}</Badge>
                  <Badge>{item.source_label || formatLabel(item.document_type || `evidence-${index}`)}</Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                  {[item.section_title, item.page_number ? `Page ${item.page_number}` : null, item.score_note]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payload JSON</CardTitle>
          <CardDescription>The detail page keeps the exact saved payload available for inspection.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-3xl bg-[var(--color-ink)] px-5 py-4 text-xs leading-6 text-[var(--color-paper)]">
            {JSON.stringify(report.payload, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

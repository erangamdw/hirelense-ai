"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { EvidencePanel } from "@/components/shared/evidence-panel";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchReportDetail } from "@/lib/api/reports";
import type { SavedReport } from "@/lib/api/types";
import { formatDateTime, formatLabel } from "@/lib/utils";

type EvidenceItem = {
  source_label?: string;
  document_type?: string;
  section_title?: string | null;
  page_number?: number | null;
  score_note?: string;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractEvidenceItems(payload: Record<string, unknown>): EvidenceItem[] {
  const evidence = payload.evidence;
  if (!Array.isArray(evidence)) {
    return [];
  }

  return evidence.filter(isObjectRecord).map((item) => ({
    source_label: typeof item.source_label === "string" ? item.source_label : undefined,
    document_type: typeof item.document_type === "string" ? item.document_type : undefined,
    section_title: typeof item.section_title === "string" ? item.section_title : null,
    page_number: typeof item.page_number === "number" ? item.page_number : null,
    score_note: typeof item.score_note === "string" ? item.score_note : undefined,
  }));
}

export function CandidateReportDetailPage({ reportId }: { reportId: number }) {
  const { accessToken, status, user } = useAuth();
  const isCandidateSession = status === "authenticated" && !!accessToken && user?.role === "candidate";
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isCandidateSession || !accessToken) {
      return;
    }

    fetchReportDetail(accessToken, reportId)
      .then((payload) => {
        setReport(payload);
        setError(null);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load report detail.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, isCandidateSession, reportId]);

  const evidenceItems = useMemo(() => {
    if (!report) {
      return [];
    }

    return extractEvidenceItems(report.payload);
  }, [report]);

  if (status === "loading" || (isCandidateSession && loading)) {
    return <LoadingGrid />;
  }

  if (status !== "authenticated") {
    return (
      <EmptyState
        title="Sign in to open report details"
        message="Candidate report detail pages are backed by the saved reports API."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate report unavailable"
        message="This route expects a candidate account."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Report detail request failed" message={error} actionHref="/candidate/reports" actionLabel="Back to reports" />;
  }

  if (!report) {
    return <EmptyState title="Report not found" message="The API did not return a report for this id." actionHref="/candidate/reports" actionLabel="Back to reports" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Candidate report detail</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{report.title}</h2>
        </div>
        <Link className="text-sm font-semibold text-[var(--color-accent)]" href="/candidate/reports">
          Back to reports
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Report metadata</CardTitle>
            <CardDescription>Core saved-report fields from the backend persistence layer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--color-ink-muted)]">
            <div className="flex flex-wrap gap-2">
              <Badge>{formatLabel(report.report_type)}</Badge>
              <Badge>Version {report.payload_version}</Badge>
            </div>
            <p>Created: {formatDateTime(report.created_at)}</p>
            <p>Owner role: {formatLabel(report.owner_role)}</p>
            <p>Query: {report.query}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export placeholder</CardTitle>
            <CardDescription>Copy the persisted payload JSON for manual review or future export actions.</CardDescription>
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

      {evidenceItems.length ? (
        <EvidencePanel
          items={evidenceItems.map((item) => ({
            label: item.source_label || formatLabel(item.document_type || "evidence"),
            detail: [item.section_title, item.page_number ? `Page ${item.page_number}` : null, item.score_note]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payload JSON</CardTitle>
          <CardDescription>The detail page renders the exact saved payload until a report-type-specific viewer is added.</CardDescription>
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

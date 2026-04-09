"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CitationLinks } from "@/components/candidate/candidate-generation-workspace";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { GeneratedRichText } from "@/components/shared/generated-rich-text";
import { LoadingGrid } from "@/components/shared/loading-grid";
import { Badge } from "@/components/ui/badge";
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

type CandidateQuestionItem = {
  category: string;
  question: string;
  rationale: string;
  evidence_chunk_ids: number[];
};

type SkillGapItem = {
  skill_area: string;
  severity: string;
  summary: string;
  recommendation: string;
  evidence_chunk_ids: number[];
};

type StrengthItem = {
  title: string;
  summary: string;
  evidence_chunk_ids: number[];
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : null;
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

function extractQuestionItems(payload: Record<string, unknown>): CandidateQuestionItem[] {
  if (!Array.isArray(payload.questions)) {
    return [];
  }

  return payload.questions.filter(isObjectRecord).map((item) => ({
    category: getString(item.category) ?? "question",
    question: getString(item.question) ?? "",
    rationale: getString(item.rationale) ?? "",
    evidence_chunk_ids: Array.isArray(item.evidence_chunk_ids)
      ? item.evidence_chunk_ids.filter((entry): entry is number => typeof entry === "number")
      : [],
  }));
}

function extractStrengthItems(value: unknown): StrengthItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObjectRecord).map((item) => ({
    title: getString(item.title) ?? "Untitled",
    summary: getString(item.summary) ?? "",
    evidence_chunk_ids: Array.isArray(item.evidence_chunk_ids)
      ? item.evidence_chunk_ids.filter((entry): entry is number => typeof entry === "number")
      : [],
  }));
}

function extractSkillGapItems(value: unknown): SkillGapItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObjectRecord).map((item) => ({
    skill_area: getString(item.skill_area) ?? "skill gap",
    severity: getString(item.severity) ?? "medium",
    summary: getString(item.summary) ?? "",
    recommendation: getString(item.recommendation) ?? "",
    evidence_chunk_ids: Array.isArray(item.evidence_chunk_ids)
      ? item.evidence_chunk_ids.filter((entry): entry is number => typeof entry === "number")
      : [],
  }));
}

function MetadataCard({ report }: { report: SavedReport }) {
  const provider = getString(report.payload.provider);
  const model = getString(report.payload.model);
  const temperature = getNumber(report.payload.temperature);
  const maxOutputTokens = getNumber(report.payload.max_output_tokens);
  const evidenceCount = getNumber(report.payload.evidence_count);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report metadata</CardTitle>
        <CardDescription>Saved generation settings, timing, and the original prompt used for this report.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[var(--color-ink-muted)]">
        <div className="flex flex-wrap gap-2">
          <Badge>{formatLabel(report.report_type)}</Badge>
          <Badge>Version {report.payload_version}</Badge>
          {provider ? <Badge>{provider}</Badge> : null}
          {model ? <Badge>{model}</Badge> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Created</p>
            <p className="mt-2 text-sm text-[var(--color-ink)]">{formatDateTime(report.created_at)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Generation settings</p>
            <p className="mt-2 text-sm text-[var(--color-ink)]">
              {temperature !== null ? `Temperature ${temperature}` : "Temperature unavailable"}
              {maxOutputTokens !== null ? ` · Token budget ${maxOutputTokens}` : ""}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Prompt</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--color-ink)]">{report.query}</p>
          {evidenceCount !== null ? (
            <p className="mt-3 text-xs font-medium text-[var(--color-ink-soft)]">{`${evidenceCount} evidence chunk${evidenceCount === 1 ? "" : "s"} used`}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateQuestionsView({ payload }: { payload: Record<string, unknown> }) {
  const overview = getString(payload.overview);
  const questions = extractQuestionItems(payload);

  return (
    <div className="space-y-6">
      {overview ? (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneratedRichText text={overview} variant="framed" />
          </CardContent>
        </Card>
      ) : null}

      {questions.length ? (
        <div className="grid gap-4">
          {questions.map((item, index) => (
            <Card key={`${item.question}-${index}`} className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge>{`Q${index + 1}`}</Badge>
                  <Badge>{formatLabel(item.category)}</Badge>
                </div>
                <CardTitle className="break-words text-xl leading-8">{item.question}</CardTitle>
                <div className="mt-3 rounded-2xl bg-white/70 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Why this matters</p>
                  <div className="mt-2">
                    <GeneratedRichText text={item.rationale} variant="plain" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CitationLinks chunkIds={item.evidence_chunk_ids} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CandidateAnswerGuidanceView({ payload }: { payload: Record<string, unknown> }) {
  const openingAnswer = getString(payload.opening_answer);
  const answerDraft = getString(payload.answer_draft);
  const strongerTip = getString(payload.stronger_version_tip);
  const talkingPoints = isStringArray(payload.talking_points) ? payload.talking_points : [];
  const followUpQuestions = isStringArray(payload.follow_up_questions) ? payload.follow_up_questions : [];

  return (
    <div className="space-y-6">
      {openingAnswer ? (
        <Card>
          <CardHeader>
            <CardTitle>Opening answer</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneratedRichText text={openingAnswer} variant="framed" />
          </CardContent>
        </Card>
      ) : null}

      {answerDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>Answer draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-5">
              <GeneratedRichText text={answerDraft} variant="framed" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {talkingPoints.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Talking points</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {talkingPoints.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">{`Talking point ${index + 1}`}</p>
                <div className="mt-3">
                  <GeneratedRichText text={item} variant="plain" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {followUpQuestions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Follow-up pressure test</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {followUpQuestions.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">{`Question ${index + 1}`}</p>
                <div className="mt-3">
                  <GeneratedRichText text={item} variant="plain" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {strongerTip ? (
        <Card>
          <CardHeader>
            <CardTitle>Stronger version tip</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneratedRichText text={strongerTip} variant="framed" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CandidateStarView({ payload }: { payload: Record<string, unknown> }) {
  const editableDraft = getString(payload.editable_draft);
  const missingSignals = isStringArray(payload.missing_signals) ? payload.missing_signals : [];
  const sections = [
    { label: "Situation", item: isObjectRecord(payload.situation) ? payload.situation : null },
    { label: "Task", item: isObjectRecord(payload.task) ? payload.task : null },
    { label: "Action", item: isObjectRecord(payload.action) ? payload.action : null },
    { label: "Result", item: isObjectRecord(payload.result) ? payload.result : null },
  ];

  return (
    <div className="space-y-6">
      {editableDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>Editable STAR draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-ink)] px-5 py-5 text-[var(--color-paper)]">
              <GeneratedRichText text={editableDraft} variant="inverse" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ label, item }) => {
          const content = item ? getString(item.content) : null;
          const chunkIds =
            item && Array.isArray(item.evidence_chunk_ids)
              ? item.evidence_chunk_ids.filter((entry): entry is number => typeof entry === "number")
              : [];

          if (!content) {
            return null;
          }

          return (
            <Card key={label}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <GeneratedRichText text={content} variant="framed" />
                <CitationLinks chunkIds={chunkIds} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {missingSignals.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Missing signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingSignals.map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                <GeneratedRichText text={item} variant="plain" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CandidateSkillGapView({ payload }: { payload: Record<string, unknown> }) {
  const analysisSummary = getString(payload.analysis_summary);
  const strengths = extractStrengthItems(payload.strengths);
  const gaps = extractSkillGapItems(payload.missing_signals);
  const actions = isStringArray(payload.improvement_actions) ? payload.improvement_actions : [];

  return (
    <div className="space-y-6">
      {analysisSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>Analysis summary</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneratedRichText text={analysisSummary} variant="framed" />
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        {strengths.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Strengths</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {strengths.map((item) => (
                <div key={`${item.title}-${item.summary}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                  <p className="text-base font-semibold text-[var(--color-ink)]">{item.title}</p>
                  <div className="mt-3">
                    <GeneratedRichText text={item.summary} variant="plain" />
                  </div>
                  <div className="mt-3">
                    <CitationLinks chunkIds={item.evidence_chunk_ids} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {gaps.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Skill gaps</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {gaps.map((item, index) => (
                <div key={`${item.skill_area}-${index}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-[var(--color-ink)]">{formatLabel(item.skill_area)}</p>
                    <Badge>{formatLabel(item.severity)}</Badge>
                  </div>
                  <div className="mt-3">
                    <GeneratedRichText text={item.summary} variant="plain" />
                  </div>
                  <div className="mt-3 rounded-2xl bg-[var(--color-panel)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Recommended action</p>
                    <div className="mt-2">
                      <GeneratedRichText text={item.recommendation} variant="plain" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <CitationLinks chunkIds={item.evidence_chunk_ids} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {actions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Improvement actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">{`Action ${index + 1}`}</p>
                <div className="mt-2">
                  <GeneratedRichText text={item} variant="plain" />
                </div>
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
  if (reportType === "candidate_interview_questions") {
    return <CandidateQuestionsView payload={payload} />;
  }

  if (reportType === "candidate_answer_guidance") {
    return <CandidateAnswerGuidanceView payload={payload} />;
  }

  if (reportType === "candidate_star_answer") {
    return <CandidateStarView payload={payload} />;
  }

  if (reportType === "candidate_skill_gap_analysis") {
    return <CandidateSkillGapView payload={payload} />;
  }

  return null;
}

function EvidenceReferences({ items }: { items: EvidenceItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence references</CardTitle>
        <CardDescription>Saved citation targets and source labels used in this report.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
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
  );
}

export function CandidateReportDetailPage({ reportId }: { reportId: number }) {
  const { accessToken, status, user } = useAuth();
  const isCandidateSession = status === "authenticated" && !!accessToken && user?.role === "candidate";
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        message="Open your candidate account to review saved interview-prep outputs."
        actionHref="/login"
        actionLabel="Go to sign in"
      />
    );
  }

  if (user?.role !== "candidate") {
    return (
      <ErrorState
        title="Candidate report unavailable"
        message="This page is only available to candidate accounts."
        actionHref="/recruiter"
        actionLabel="Open recruiter view"
      />
    );
  }

  if (error) {
    return <ErrorState title="Report detail request failed" message={error} actionHref="/candidate/reports" actionLabel="Back to reports" />;
  }

  if (!report) {
    return <EmptyState title="Report not found" message="We could not find a saved report for this link." actionHref="/candidate/reports" actionLabel="Back to reports" />;
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

      <MetadataCard report={report} />
      <ReportSpecificView reportType={report.report_type} payload={report.payload} />
      <EvidenceReferences items={evidenceItems} />
    </div>
  );
}

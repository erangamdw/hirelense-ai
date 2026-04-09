"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { GeneratedRichText } from "@/components/shared/generated-rich-text";
import { ResultSectionTabs } from "@/components/shared/result-section-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateSkillGapAnalysis } from "@/lib/api/generation";
import type { CandidateSkillGapAnalysisResult } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

const SOURCE_PREFIX_PATTERN = /\b(?:cv|job_description|project_notes|interview_feedback|recruiter_candidate_cv):/g;

function normalizeGeneratedText(text: string) {
  return text
    .replace(SOURCE_PREFIX_PATTERN, "")
    .replace(/\s*[•▪◦·]+\s*/g, "\n- ")
    .replace(/\n-\s*-\s*/g, "\n- ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function emphasizeSummaryTopics(text: string) {
  return normalizeGeneratedText(text).replace(
    /(^|\n)(strengths?|skill gaps?|risks?|recommend(?:ed)? actions?|alignment|missing signals?|next steps?)\s*:/gim,
    (_match, prefix, label) => `${prefix}**${formatLabel(label.trim())}:**`,
  );
}

function buildPreview(text: string, maxLength = 160) {
  const normalized = normalizeGeneratedText(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

const compactPreviewStyle = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 4,
  overflow: "hidden",
};

function getSeverityTone(severity: string) {
  if (severity === "high") {
    return "bg-[rgba(190,32,63,0.14)] text-[var(--color-danger)] ring-[rgba(190,32,63,0.26)]";
  }
  if (severity === "medium") {
    return "bg-[rgba(196,127,0,0.14)] text-[rgba(146,91,0,1)] ring-[rgba(196,127,0,0.28)]";
  }
  return "bg-[rgba(15,123,76,0.14)] text-[rgba(16,115,72,1)] ring-[rgba(15,123,76,0.3)]";
}

type SkillGapDetailState =
  | { kind: "strength"; index: number }
  | { kind: "gap"; index: number }
  | null;

function SkillGapDetailDialog({
  title,
  eyebrow,
  badge,
  content,
  recommendation,
  chunkIds,
  onClose,
}: {
  title: string;
  eyebrow: string;
  badge?: { label: string; className?: string };
  content: string;
  recommendation?: string;
  chunkIds: number[];
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Close skill gap detail dialog"
        className="absolute inset-0 bg-[rgba(14,18,32,0.72)]"
        onClick={onClose}
      />
      <div className="relative z-[141] flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_30px_90px_-28px_rgba(27,31,59,0.7)]">
          <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">{eyebrow}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
                </div>
                <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h2>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <GeneratedRichText text={normalizeGeneratedText(content)} variant="framed" />
            {recommendation ? (
              <div className="rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Recommended action</p>
                <div className="mt-3">
                  <GeneratedRichText text={normalizeGeneratedText(recommendation)} variant="plain" />
                </div>
              </div>
            ) : null}
            <CitationLinks chunkIds={chunkIds} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SkillGapResult({ result }: { result: CandidateSkillGapAnalysisResult }) {
  const [activeDetail, setActiveDetail] = useState<SkillGapDetailState>(null);
  const activeStrength = activeDetail?.kind === "strength" ? result.strengths[activeDetail.index] : null;
  const activeGap = activeDetail?.kind === "gap" ? result.missing_signals[activeDetail.index] : null;
  const tabs = [
    {
      id: "analysis-summary",
      label: "Summary",
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Analysis summary</CardTitle>
            <CardDescription>Where your current evidence is strong and where interview risk is still high.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[32px] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(245,242,236,0.95)_100%)] px-6 py-6 shadow-[0_24px_60px_-34px_rgba(27,31,59,0.45)]">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-paper)]">
                  Overview
                </span>
                <p className="text-sm font-medium text-[var(--color-ink-soft)]">Read this first before drilling into specific strengths and gaps.</p>
              </div>
              <GeneratedRichText
                text={emphasizeSummaryTopics(result.analysis_summary)}
                className="space-y-5 text-[15px] leading-8 text-[var(--color-ink-muted)]"
                variant="plain"
              />
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: "strengths",
      label: "Strengths",
      badge: String(result.strengths.length),
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
            <CardDescription>Signals you should lead with in interview answers.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {result.strengths.length ? (
              result.strengths.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setActiveDetail({ kind: "strength", index })}
                  className="group flex h-full min-h-[220px] w-full flex-col overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[0_18px_40px_-28px_rgba(27,31,59,0.42)] focus:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Strength signal</p>
                      <h3 className="text-base font-semibold text-[var(--color-ink)]">{item.title}</h3>
                    </div>
                    <span className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition-colors group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-paper)]">
                      Click to open
                    </span>
                  </div>
                  <div className="mt-3 flex-1 rounded-2xl bg-[var(--color-panel)] px-4 py-3">
                    <p
                      className="break-words [overflow-wrap:anywhere] text-sm leading-7 text-[var(--color-ink-muted)]"
                      style={compactPreviewStyle}
                    >
                      {buildPreview(item.summary)}
                    </p>
                  </div>
                  <div className="mt-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                    <span>{item.evidence_chunk_ids.length ? `${item.evidence_chunk_ids.length} citation${item.evidence_chunk_ids.length > 1 ? "s" : ""}` : "No citations"}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-sm text-[var(--color-ink-muted)]">No strengths were returned from the selected evidence.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      id: "skill-gaps",
      label: "Skill gaps",
      badge: String(result.missing_signals.length),
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Skill gaps</CardTitle>
            <CardDescription>Prioritized gaps with severity and concrete recommendations.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {result.missing_signals.length ? (
              result.missing_signals.map((item, index) => (
                <button
                  key={`${item.skill_area}-${item.summary}`}
                  type="button"
                  onClick={() => setActiveDetail({ kind: "gap", index })}
                  className="group flex h-full min-h-[260px] w-full flex-col overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[0_18px_40px_-28px_rgba(27,31,59,0.42)] focus:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Gap area</p>
                      <p className="text-base font-semibold text-[var(--color-ink)]">{`${index + 1}. ${formatLabel(item.skill_area)}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`ring-1 ${getSeverityTone(item.severity)}`}>{formatLabel(item.severity)}</Badge>
                      <span className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition-colors group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-paper)]">
                        Click to open
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl bg-[var(--color-panel)] px-4 py-3">
                    <p
                      className="break-words [overflow-wrap:anywhere] text-sm leading-7 text-[var(--color-ink-muted)]"
                      style={compactPreviewStyle}
                    >
                      {buildPreview(item.summary)}
                    </p>
                  </div>
                  <div className="mt-3 flex-1 rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.78)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">Recommended action</p>
                    <p
                      className="mt-2 break-words [overflow-wrap:anywhere] text-sm leading-7 text-[var(--color-ink-muted)]"
                      style={compactPreviewStyle}
                    >
                      {buildPreview(item.recommendation, 110)}
                    </p>
                  </div>
                  <div className="mt-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                    <span>{item.evidence_chunk_ids.length ? `${item.evidence_chunk_ids.length} citation${item.evidence_chunk_ids.length > 1 ? "s" : ""}` : "No citations"}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-sm text-[var(--color-ink-muted)]">No gaps were detected with the current scope.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      badge: String(result.improvement_actions.length),
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Improvement actions</CardTitle>
            <CardDescription>Practical next steps you can take to close the most important gaps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.improvement_actions.length ? (
              result.improvement_actions.map((item, index) => (
                <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4 shadow-[0_14px_34px_-30px_rgba(27,31,59,0.35)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--color-ink)] px-2 text-xs font-semibold text-[var(--color-paper)]">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--color-ink)]">Action item</p>
                      <div className="mt-2">
                        <GeneratedRichText text={normalizeGeneratedText(item)} variant="plain" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-sm text-[var(--color-ink-muted)]">No improvement actions were generated.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ResultSectionTabs tabs={tabs} defaultTabId="analysis-summary" />

      {activeStrength ? (
        <SkillGapDetailDialog
          title={activeStrength.title}
          eyebrow="Strength signal"
          content={activeStrength.summary}
          chunkIds={activeStrength.evidence_chunk_ids}
          onClose={() => setActiveDetail(null)}
        />
      ) : null}

      {activeGap ? (
        <SkillGapDetailDialog
          title={formatLabel(activeGap.skill_area)}
          eyebrow="Skill gap"
          badge={{
            label: formatLabel(activeGap.severity),
            className: `ring-1 ${getSeverityTone(activeGap.severity)}`,
          }}
          content={activeGap.summary}
          recommendation={activeGap.recommendation}
          chunkIds={activeGap.evidence_chunk_ids}
          onClose={() => setActiveDetail(null)}
        />
      ) : null}
    </div>
  );
}

export function CandidateSkillGapPage() {
  return (
    <CandidateGenerationWorkspace
      title="Skill-gap analysis"
      description="Compare candidate-side evidence against the target role and surface missing signals with concrete actions."
      promptLabel="Gap analysis target"
      promptPlaceholder="Describe the role, interview target, or comparison you want the analysis to evaluate."
      defaultQuery="What skill gaps should I address to look stronger for this target role?"
      generateButtonLabel="Generate skill-gap analysis"
      generatingButtonLabel="Generating skill-gap analysis..."
      emptyResultTitle="No skill-gap report yet"
      emptyResultMessage="Run the assistant to compare your evidence against the role and surface missing signals."
      reportType="candidate_skill_gap_analysis"
      generate={generateCandidateSkillGapAnalysis}
      renderResult={(result) => <SkillGapResult result={result} />}
    />
  );
}

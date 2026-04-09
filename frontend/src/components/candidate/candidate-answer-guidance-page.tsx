"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { GeneratedRichText } from "@/components/shared/generated-rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateAnswerGuidance } from "@/lib/api/generation";
import type { CandidateAnswerGuidanceResult } from "@/lib/api/types";

const SOURCE_PREFIX_PATTERN = /\b(?:cv|job_description|project_notes|interview_feedback|recruiter_candidate_cv):/g;

function sanitizeGuidanceItemText(text: string) {
  return text
    .replace(SOURCE_PREFIX_PATTERN, "")
    .replace(/^Use\s+([^\s]+)\s+to highlight\s+/i, "Highlight ")
    .replace(/^Use\s+([^\s]+)\s+to\s+/i, "")
    .trim();
}

function buildPreview(text: string, maxLength = 120) {
  const normalized = sanitizeGuidanceItemText(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

type GuidanceDetailState = {
  section: "talking_points" | "follow_up_questions";
  index: number;
} | null;

function GuidanceDetailDialog({
  title,
  items,
  activeIndex,
  sectionLabel,
  onClose,
  onSelect,
}: {
  title: string;
  items: string[];
  activeIndex: number | null;
  sectionLabel: string;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const activeItem = activeIndex !== null ? sanitizeGuidanceItemText(items[activeIndex] ?? "") : null;

  useEffect(() => {
    if (!activeItem) {
      return;
    }

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
  }, [activeItem, onClose]);

  if (activeItem === null || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Close detail dialog"
        className="absolute inset-0 bg-[rgba(14,18,32,0.7)]"
        onClick={onClose}
      />

      <div className="relative z-[141] flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_30px_90px_-28px_rgba(27,31,59,0.7)]">
          <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">{sectionLabel}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{`${title} ${activeIndex + 1}`}</Badge>
                </div>
                <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{`${title} ${activeIndex + 1}`}</h2>
              </div>

              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>

            {items.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {items.map((_, index) => (
                  <button
                    key={`${title}-${index}`}
                    type="button"
                    onClick={() => onSelect(index)}
                    className={
                      index === activeIndex
                        ? "rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-semibold text-[var(--color-paper)] outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                        : "rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)] outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                    }
                  >
                    {`${title} ${index + 1}`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            <GeneratedRichText text={activeItem} variant="framed" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ExpandableGuidanceSection({
  title,
  sectionLabel,
  items,
  onOpen,
}: {
  title: string;
  sectionLabel: string;
  items: string[];
  onOpen: (index: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Click any card to open the full text in a focused view.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <button
            key={`${title}-${index}`}
            type="button"
            onClick={() => onOpen(index)}
            className="group overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[0_18px_40px_-28px_rgba(27,31,59,0.42)] focus:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">{sectionLabel}</p>
                <p className="text-base font-semibold text-[var(--color-ink)]">{`${title} ${index + 1}`}</p>
              </div>
              <span className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition-colors group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-paper)]">
                Click to open
              </span>
            </div>
            <div className="mt-3 rounded-2xl bg-[var(--color-panel)] px-4 py-3">
              <p className="break-words [overflow-wrap:anywhere] text-sm leading-7 text-[var(--color-ink-muted)]">
                {buildPreview(item)}
              </p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function AnswerGuidanceResult({ result }: { result: CandidateAnswerGuidanceResult }) {
  const [activeDetail, setActiveDetail] = useState<GuidanceDetailState>(null);
  const activeItems =
    activeDetail?.section === "talking_points" ? result.talking_points : result.follow_up_questions;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Opening answer</CardTitle>
          <CardDescription>Start with a direct answer before expanding into supporting detail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GeneratedRichText text={result.opening_answer} variant="framed" />
          <CitationLinks
            chunkIds={result.evidence.length ? [result.evidence[0].chunk_id] : []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answer draft</CardTitle>
          <CardDescription>A structured answer you can refine, rehearse, and shorten for the interview.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-5">
            <GeneratedRichText text={result.answer_draft} variant="framed" />
          </div>
        </CardContent>
      </Card>

      <ExpandableGuidanceSection
        title="Talking point"
        sectionLabel="Talking points"
        items={result.talking_points}
        onOpen={(index) => setActiveDetail({ section: "talking_points", index })}
      />

      <ExpandableGuidanceSection
        title="Pressure-test question"
        sectionLabel="Follow-up pressure test"
        items={result.follow_up_questions}
        onOpen={(index) => setActiveDetail({ section: "follow_up_questions", index })}
      />

      <Card>
        <CardHeader>
          <CardTitle>Stronger version tip</CardTitle>
          <CardDescription>What to tighten before using this answer in a real interview.</CardDescription>
        </CardHeader>
        <CardContent>
          <GeneratedRichText text={result.stronger_version_tip} variant="framed" />
        </CardContent>
      </Card>

      <GuidanceDetailDialog
        title={activeDetail?.section === "talking_points" ? "Talking point" : "Pressure-test question"}
        sectionLabel={activeDetail?.section === "talking_points" ? "Talking points" : "Follow-up pressure test"}
        items={activeItems}
        activeIndex={activeDetail?.index ?? null}
        onClose={() => setActiveDetail(null)}
        onSelect={(index) =>
          setActiveDetail((current) => (current ? { ...current, index } : current))
        }
      />
    </div>
  );
}

export function CandidateAnswerGuidancePage() {
  return (
    <CandidateGenerationWorkspace
      title="Answer guidance"
      description="Generate an opening answer, supporting talking points, and tougher follow-up questions from retrieved evidence."
      promptLabel="Answer target"
      promptPlaceholder="Describe the interview question or role-fit angle you want help answering."
      defaultQuery="How should I answer questions about why I am a strong fit for this role?"
      generateButtonLabel="Generate answer guidance"
      generatingButtonLabel="Generating guidance..."
      emptyResultTitle="No answer guidance yet"
      emptyResultMessage="Run the assistant to generate an answer draft, talking points, and follow-up questions."
      reportType="candidate_answer_guidance"
      generate={generateCandidateAnswerGuidance}
      renderResult={(result) => <AnswerGuidanceResult result={result} />}
    />
  );
}

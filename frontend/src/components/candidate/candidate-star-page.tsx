"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GeneratedRichText } from "@/components/shared/generated-rich-text";
import { ResultSectionTabs } from "@/components/shared/result-section-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateStarAnswer } from "@/lib/api/generation";
import type { CandidateStarAnswerResult } from "@/lib/api/types";

type StarSectionKey = "situation" | "task" | "action" | "result";
type StarDetailState = { section: StarSectionKey } | null;

const SOURCE_PREFIX_PATTERN = /\b(?:cv|job_description|project_notes|interview_feedback|recruiter_candidate_cv):/g;

function sanitizeStarText(text: string) {
  return text
    .replace(SOURCE_PREFIX_PATTERN, "")
    .replace(/\s*[•▪◦·]+\s*/g, "\n- ")
    .replace(/\n-\s*-\s*/g, "\n- ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function buildPreview(text: string, maxLength = 170) {
  const normalized = sanitizeStarText(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function StarSectionDialog({
  section,
  onClose,
}: {
  section:
    | {
        key: StarSectionKey;
        label: string;
        content: string;
        chunkIds: number[];
      }
    | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!section) {
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
  }, [section, onClose]);

  if (!section || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Close STAR section dialog"
        className="absolute inset-0 bg-[rgba(14,18,32,0.7)]"
        onClick={onClose}
      />
      <div className="relative z-[141] flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_30px_90px_-28px_rgba(27,31,59,0.7)]">
          <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">STAR section</p>
                <Badge>{section.label}</Badge>
                <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{section.label}</h2>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <GeneratedRichText text={sanitizeStarText(section.content)} variant="framed" />
            <CitationLinks chunkIds={section.chunkIds} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StarSectionPreviewCards({
  onOpen,
  sections,
}: {
  onOpen: (key: StarSectionKey) => void;
  sections: Array<{ key: StarSectionKey; label: string; content: string; chunkIds: number[] }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>STAR sections</CardTitle>
        <CardDescription>Click any card to open the full section in a focused view.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => onOpen(section.key)}
            className="group overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[0_18px_40px_-28px_rgba(27,31,59,0.42)] focus:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">STAR section</p>
                <p className="text-base font-semibold text-[var(--color-ink)]">{section.label}</p>
              </div>
              <span className="rounded-full bg-[var(--color-panel)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition-colors group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-paper)]">
                Click to open
              </span>
            </div>
            <div className="mt-3 rounded-2xl bg-[var(--color-panel)] px-4 py-3">
              <p className="break-words [overflow-wrap:anywhere] text-sm leading-7 text-[var(--color-ink-muted)]">
                {buildPreview(section.content)}
              </p>
            </div>
            <div className="mt-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
              <span>
                {section.chunkIds.length
                  ? `${section.chunkIds.length} citation${section.chunkIds.length > 1 ? "s" : ""}`
                  : "No citations"}
              </span>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function StarResult({ result }: { result: CandidateStarAnswerResult }) {
  const [activeDetail, setActiveDetail] = useState<StarDetailState>(null);
  const sections: Array<{ key: StarSectionKey; label: string; content: string; chunkIds: number[] }> = [
    { key: "situation", label: "Situation", content: result.situation.content, chunkIds: result.situation.evidence_chunk_ids },
    { key: "task", label: "Task", content: result.task.content, chunkIds: result.task.evidence_chunk_ids },
    { key: "action", label: "Action", content: result.action.content, chunkIds: result.action.evidence_chunk_ids },
    { key: "result", label: "Result", content: result.result.content, chunkIds: result.result.evidence_chunk_ids },
  ];
  const activeSection = activeDetail ? sections.find((section) => section.key === activeDetail.section) ?? null : null;
  const tabs = [
    {
      id: "editable-draft",
      label: "STAR draft",
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Editable STAR draft</CardTitle>
            <CardDescription>A complete STAR response you can refine before the interview.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-ink)] px-5 py-5 text-[var(--color-paper)]">
              <GeneratedRichText
                text={result.editable_draft}
                variant="inverse"
              />
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: "star-sections",
      label: "STAR sections",
      badge: String(sections.length),
      content: <StarSectionPreviewCards sections={sections} onOpen={(key) => setActiveDetail({ section: key })} />,
    },
    {
      id: "missing-signals",
      label: "Missing signals",
      badge: String(result.missing_signals.length),
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Missing signals</CardTitle>
            <CardDescription>Details that would make the answer stronger or more convincing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.missing_signals.length ? (
              result.missing_signals.map((item) => (
                <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                  <GeneratedRichText text={item} variant="plain" />
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-ink-muted)]">No obvious missing signals were returned.</p>
            )}
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ResultSectionTabs tabs={tabs} defaultTabId="star-sections" />
      <StarSectionDialog section={activeSection} onClose={() => setActiveDetail(null)} />
    </div>
  );
}

export function CandidateStarPage() {
  return (
    <CandidateGenerationWorkspace
      title="STAR answer drafting"
      description="Generate a structured Situation, Task, Action, and Result response grounded in your stored evidence."
      promptLabel="STAR target"
      promptPlaceholder="Describe the interview question or project context that should be turned into a STAR answer."
      defaultQuery="Create a STAR answer for one of my strongest examples that matches this target role."
      generateButtonLabel="Generate STAR draft"
      generatingButtonLabel="Generating STAR draft..."
      emptyResultTitle="No STAR draft yet"
      emptyResultMessage="Run the assistant to generate an editable STAR response with section-level citations."
      reportType="candidate_star_answer"
      generate={generateCandidateStarAnswer}
      renderResult={(result) => <StarResult result={result} />}
    />
  );
}

"use client";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateSkillGapAnalysis } from "@/lib/api/generation";
import type { CandidateSkillGapAnalysisResult } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function SkillGapResult({ result }: { result: CandidateSkillGapAnalysisResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analysis summary</CardTitle>
          <CardDescription>Backend summary of where your evidence aligns and where it is thin.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-ink-muted)]">
            {result.analysis_summary}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.strengths.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--color-ink-muted)]">
                  {item.summary}
                </p>
                <div className="mt-3">
                  <CitationLinks chunkIds={item.evidence_chunk_ids} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skill gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.missing_signals.map((item) => (
              <div key={`${item.skill_area}-${item.summary}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-[var(--color-ink)]">{formatLabel(item.skill_area)}</p>
                  <Badge>{formatLabel(item.severity)}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--color-ink-muted)]">
                  {item.summary}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--color-ink-muted)]">
                  {item.recommendation}
                </p>
                <div className="mt-3">
                  <CitationLinks chunkIds={item.evidence_chunk_ids} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Improvement actions</CardTitle>
          <CardDescription>Concrete next steps returned by the backend for closing the gap.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.improvement_actions.map((item) => (
            <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-ink-muted)]">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
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

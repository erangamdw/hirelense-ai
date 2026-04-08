"use client";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateStarAnswer } from "@/lib/api/generation";
import type { CandidateStarAnswerResult } from "@/lib/api/types";

function StarSectionCard({
  label,
  content,
  chunkIds,
}: {
  label: string;
  content: string;
  chunkIds: number[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-7 text-[var(--color-ink-muted)]">{content}</p>
        <CitationLinks chunkIds={chunkIds} />
      </CardContent>
    </Card>
  );
}

function StarResult({ result }: { result: CandidateStarAnswerResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Editable STAR draft</CardTitle>
          <CardDescription>The full draft returned by the structured STAR endpoint.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-3xl bg-[var(--color-ink)] px-5 py-4 text-sm leading-7 text-[var(--color-paper)]">
            {result.editable_draft}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <StarSectionCard
          label="Situation"
          content={result.situation.content}
          chunkIds={result.situation.evidence_chunk_ids}
        />
        <StarSectionCard
          label="Task"
          content={result.task.content}
          chunkIds={result.task.evidence_chunk_ids}
        />
        <StarSectionCard
          label="Action"
          content={result.action.content}
          chunkIds={result.action.evidence_chunk_ids}
        />
        <StarSectionCard
          label="Result"
          content={result.result.content}
          chunkIds={result.result.evidence_chunk_ids}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Missing signals</CardTitle>
          <CardDescription>Evidence gaps the backend detected while building the STAR response.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.missing_signals.length ? (
            result.missing_signals.map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                <p className="text-sm text-[var(--color-ink-muted)]">{item}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">No obvious missing signals were returned.</p>
          )}
        </CardContent>
      </Card>
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

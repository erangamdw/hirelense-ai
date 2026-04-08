"use client";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateAnswerGuidance } from "@/lib/api/generation";
import type { CandidateAnswerGuidanceResult } from "@/lib/api/types";

function AnswerGuidanceResult({ result }: { result: CandidateAnswerGuidanceResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Opening answer</CardTitle>
          <CardDescription>Start with a direct answer before expanding into supporting detail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-ink-muted)]">
            {result.opening_answer}
          </p>
          <CitationLinks
            chunkIds={result.evidence.length ? [result.evidence[0].chunk_id] : []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answer draft</CardTitle>
          <CardDescription>Backend-generated answer guidance from the current evidence set.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--color-ink-muted)]">{result.answer_draft}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Talking points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.talking_points.map((item) => (
            <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-ink-muted)]">{item}</p>
            </div>
          ))}
        </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-up pressure test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.follow_up_questions.map((item) => (
            <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-ink-muted)]">{item}</p>
            </div>
          ))}
        </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stronger version tip</CardTitle>
          <CardDescription>What to tighten before using this answer in a real interview.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-ink-muted)]">
            {result.stronger_version_tip}
          </p>
        </CardContent>
      </Card>
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

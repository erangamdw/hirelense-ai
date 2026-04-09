"use client";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { GeneratedRichText } from "@/components/shared/generated-rich-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateInterviewQuestions } from "@/lib/api/generation";
import type { CandidateInterviewQuestionsResult } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function sanitizePromptText(value: string) {
  return value
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/^\s*Q\d+\s*[:.-]?\s*/i, "")
    .trim();
}

function extractPromptPresentation(question: string) {
  const normalized = sanitizePromptText(question);
  const colonIndex = normalized.indexOf(":");

  if (colonIndex > 0 && colonIndex < 48) {
    const heading = normalized.slice(0, colonIndex).trim();
    const body = normalized.slice(colonIndex + 1).trim();

    if (body.length > 12) {
      return { heading, body };
    }
  }

  return { heading: null, body: normalized };
}

function QuestionsResult({ result }: { result: CandidateInterviewQuestionsResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>A short summary of what the interviewer is likely to probe based on your selected evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-5">
            <GeneratedRichText text={result.overview} variant="framed" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {result.questions.map((item, index) => {
          const prompt = extractPromptPresentation(item.question);

          return (
            <Card key={`${item.question}-${index}`} className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{`Q${index + 1}`}</Badge>
                  <Badge>{formatLabel(item.category)}</Badge>
                  {prompt.heading ? <Badge>{prompt.heading}</Badge> : null}
                </div>
                <CardTitle className="break-words text-xl leading-8">{prompt.body}</CardTitle>
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
          );
        })}
      </div>
    </div>
  );
}

export function CandidateQuestionsPage() {
  return (
    <CandidateGenerationWorkspace
      title="Likely interview questions"
      description="Generate interviewer-style prompts from your CV, job description, project notes, and feedback documents."
      promptLabel="Question target"
      promptPlaceholder="Paste the role prompt or describe the kind of interview questions you want."
      defaultQuery="Generate likely interview questions for this target role and explain which parts of my background they are probing."
      generateButtonLabel="Generate likely questions"
      generatingButtonLabel="Generating questions..."
      emptyResultTitle="No question set yet"
      emptyResultMessage="Run the assistant to generate grounded interview questions and evidence-backed rationales."
      reportType="candidate_interview_questions"
      generate={generateCandidateInterviewQuestions}
      renderResult={(result) => <QuestionsResult result={result} />}
    />
  );
}

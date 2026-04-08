"use client";

import { CitationLinks, CandidateGenerationWorkspace } from "@/components/candidate/candidate-generation-workspace";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateInterviewQuestions } from "@/lib/api/generation";
import type { CandidateInterviewQuestionsResult } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function QuestionsResult({ result }: { result: CandidateInterviewQuestionsResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>The backend summary for the likely-question set.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-ink-muted)]">
            {result.overview}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {result.questions.map((item, index) => (
          <Card key={`${item.question}-${index}`}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{`Q${index + 1}`}</Badge>
                <Badge>{formatLabel(item.category)}</Badge>
              </div>
              <CardTitle className="break-words text-xl leading-8">{item.question}</CardTitle>
              <CardDescription className="whitespace-pre-wrap break-words">{item.rationale}</CardDescription>
            </CardHeader>
            <CardContent>
              <CitationLinks chunkIds={item.evidence_chunk_ids} />
            </CardContent>
          </Card>
        ))}
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

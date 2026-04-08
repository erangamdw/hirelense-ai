"use client";

import { RecruiterCitationLinks, RecruiterGenerationWorkspace } from "@/components/recruiter/recruiter-generation-workspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateRecruiterInterviewPack } from "@/lib/api/generation";
import type { RecruiterInterviewPackResult } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function InterviewPackResult({ result }: { result: RecruiterInterviewPackResult }) {
  const groupedProbes = result.probes.reduce<Record<string, typeof result.probes>>((groups, probe) => {
    const key = probe.category;
    groups[key] = [...(groups[key] || []), probe];
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Interview pack overview</CardTitle>
          <CardDescription>Recruiter-facing overview returned by the interview-pack endpoint.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-[var(--color-ink-muted)]">{result.overview}</p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {Object.entries(groupedProbes).map(([category, probes]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{formatLabel(category)}</CardTitle>
              <CardDescription>Grouped interview questions and rationale for this evidence-backed area.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {probes.map((probe, index) => (
                <div key={`${probe.prompt}-${index}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                  <p className="font-medium text-[var(--color-ink)]">{probe.prompt}</p>
                  <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{probe.rationale}</p>
                  <div className="mt-3">
                    <RecruiterCitationLinks chunkIds={probe.evidence_chunk_ids} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up questions</CardTitle>
          <CardDescription>Additional probes to validate depth, ownership, and outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.follow_up_questions.map((question) => (
            <div key={question} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
              <p className="text-sm text-[var(--color-ink-muted)]">{question}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function RecruiterInterviewPackPage({
  jobId,
  candidateId,
}: {
  jobId: number;
  candidateId: number;
}) {
  return (
    <RecruiterGenerationWorkspace
      jobId={jobId}
      candidateId={candidateId}
      title="Interview pack page"
      description="Generate grouped interview probes, rationale, follow-up questions, and evidence references for this candidate scope."
      promptLabel="Interview pack target"
      promptPlaceholder="Describe the role or focus area you want the interview pack to screen for."
      defaultQuery="Create an interview pack for this candidate against the target role with grouped probes and evidence-backed rationale."
      generateButtonLabel="Generate interview pack"
      generatingButtonLabel="Generating interview pack..."
      emptyResultTitle="No interview pack yet"
      emptyResultMessage="Run the recruiter interview-pack flow to generate grouped questions, rationale, and evidence references."
      reportType="recruiter_interview_pack"
      generate={generateRecruiterInterviewPack}
      renderResult={(result) => <InterviewPackResult result={result} />}
    />
  );
}

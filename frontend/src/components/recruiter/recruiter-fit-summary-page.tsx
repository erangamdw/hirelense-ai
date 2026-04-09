"use client";

import { RecruiterCitationLinks, RecruiterGenerationWorkspace } from "@/components/recruiter/recruiter-generation-workspace";
import { GeneratedRichText } from "@/components/shared/generated-rich-text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateRecruiterFitSummary } from "@/lib/api/generation";
import type { RecruiterFitSummaryResult } from "@/lib/api/types";

function FitSummaryResult({ result }: { result: RecruiterFitSummaryResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fit summary</CardTitle>
          <CardDescription>Recruiter-facing summary grounded in the scoped job and candidate evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-5">
            <GeneratedRichText text={result.summary} variant="framed" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
            <CardDescription>Grounded strengths to validate during the interview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.strengths.map((item) => (
              <div key={`${item.title}-${item.summary}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                <div className="mt-2">
                  <GeneratedRichText text={item.summary} variant="plain" />
                </div>
                <div className="mt-3">
                  <RecruiterCitationLinks chunkIds={item.evidence_chunk_ids} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Concerns</CardTitle>
            <CardDescription>Potential risks or weak signals that need direct probing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.concerns.map((item) => (
              <div key={`${item.title}-${item.summary}`} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                <div className="mt-2">
                  <GeneratedRichText text={item.summary} variant="plain" />
                </div>
                <div className="mt-3">
                  <RecruiterCitationLinks chunkIds={item.evidence_chunk_ids} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Missing evidence</CardTitle>
            <CardDescription>Signals the current recruiter evidence set still does not prove.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.missing_evidence_areas.map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                <GeneratedRichText text={item} variant="plain" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendation</CardTitle>
            <CardDescription>Suggested interview direction based on strengths and missing signals.</CardDescription>
        </CardHeader>
        <CardContent>
          <GeneratedRichText text={result.recommendation} variant="framed" />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export function RecruiterFitSummaryPage({
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
      title="Fit summary"
      description="Generate a recruiter-facing fit summary with strengths, concerns, missing signals, and a grounded recommendation."
      promptLabel="Fit summary target"
      promptPlaceholder="Describe the role-fit angle or screening question you want the summary to focus on."
      defaultQuery="Summarize this candidate's fit for the role and highlight the main strengths, concerns, and missing evidence."
      generateButtonLabel="Generate fit summary"
      generatingButtonLabel="Generating fit summary..."
      emptyResultTitle="No fit summary yet"
      emptyResultMessage="Run the recruiter analysis to generate fit sections, evidence references, and a recommendation."
      reportType="recruiter_fit_summary"
      generate={generateRecruiterFitSummary}
      renderResult={(result) => <FitSummaryResult result={result} />}
    />
  );
}

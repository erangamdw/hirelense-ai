import { RecruiterFitSummaryPage } from "@/components/recruiter/recruiter-fit-summary-page";

export default async function RecruiterCandidateAnalysisRoute({
  params,
}: {
  params: Promise<{ jobId: string; candidateId: string }>;
}) {
  const { jobId, candidateId } = await params;
  return <RecruiterFitSummaryPage jobId={Number(jobId)} candidateId={Number(candidateId)} />;
}

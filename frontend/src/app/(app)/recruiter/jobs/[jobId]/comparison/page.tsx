import { RecruiterCandidateComparisonPage } from "@/components/recruiter/recruiter-candidate-comparison-page";

export default async function RecruiterCandidateComparisonRoute({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <RecruiterCandidateComparisonPage jobId={Number(jobId)} />;
}

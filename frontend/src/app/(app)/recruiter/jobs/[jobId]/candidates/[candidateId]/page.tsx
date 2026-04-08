import { RecruiterCandidatePage } from "@/components/recruiter/recruiter-candidate-page";

export default async function RecruiterCandidateRoute({
  params,
}: {
  params: Promise<{ jobId: string; candidateId: string }>;
}) {
  const { jobId, candidateId } = await params;
  return <RecruiterCandidatePage jobId={Number(jobId)} candidateId={Number(candidateId)} />;
}

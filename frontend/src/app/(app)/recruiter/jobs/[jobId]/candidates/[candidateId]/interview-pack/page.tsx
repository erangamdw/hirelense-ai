import { RecruiterInterviewPackPage } from "@/components/recruiter/recruiter-interview-pack-page";

export default async function RecruiterInterviewPackRoute({
  params,
}: {
  params: Promise<{ jobId: string; candidateId: string }>;
}) {
  const { jobId, candidateId } = await params;
  return <RecruiterInterviewPackPage jobId={Number(jobId)} candidateId={Number(candidateId)} />;
}

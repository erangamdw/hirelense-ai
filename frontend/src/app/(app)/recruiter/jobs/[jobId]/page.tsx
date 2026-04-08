import { RecruiterJobDetailPage } from "@/components/recruiter/recruiter-job-detail-page";

export default async function RecruiterJobDetailRoute({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <RecruiterJobDetailPage jobId={Number(jobId)} />;
}

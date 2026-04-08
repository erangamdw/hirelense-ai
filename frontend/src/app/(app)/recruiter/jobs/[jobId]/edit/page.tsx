import { RecruiterEditJobPage } from "@/components/recruiter/recruiter-edit-job-page";

export default async function RecruiterEditJobRoute({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <RecruiterEditJobPage jobId={Number(jobId)} />;
}

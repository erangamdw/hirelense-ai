import { RecruiterReportsPage } from "@/components/recruiter/recruiter-reports-page";

function parseOptionalNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function RecruiterReportsRoute({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; candidateId?: string }>;
}) {
  const params = await searchParams;
  return (
    <RecruiterReportsPage
      recruiterJobId={parseOptionalNumber(params.jobId)}
      recruiterCandidateId={parseOptionalNumber(params.candidateId)}
    />
  );
}

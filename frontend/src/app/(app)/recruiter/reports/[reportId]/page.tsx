import { RecruiterReportDetailPage } from "@/components/recruiter/recruiter-report-detail-page";

export default async function RecruiterReportDetailRoute({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <RecruiterReportDetailPage reportId={Number(reportId)} />;
}

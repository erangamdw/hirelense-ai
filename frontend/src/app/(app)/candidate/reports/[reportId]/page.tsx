import { CandidateReportDetailPage } from "@/components/candidate/candidate-report-detail-page";

export default async function CandidateReportDetailRoute({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <CandidateReportDetailPage reportId={Number(reportId)} />;
}

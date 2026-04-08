import { AppShell } from "@/components/layout/app-shell";

export default function RecruiterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell
      role="recruiter"
      title="Recruiter workspace"
      subtitle="Live recruiter workflow for dashboard summary, job management, candidate intake, scoped uploads, and review summaries."
    >
      {children}
    </AppShell>
  );
}

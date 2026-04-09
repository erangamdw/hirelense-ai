import { AppShell } from "@/components/layout/app-shell";

export default function CandidateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell
      role="candidate"
      title="Candidate workspace"
      subtitle="Build your profile, upload your documents, generate interview prep, and return to saved reports in one place."
    >
      {children}
    </AppShell>
  );
}

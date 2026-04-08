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
      subtitle="Live candidate workflow for profile setup, document intake, grounded interview prep, and saved report history on top of the FastAPI backend."
    >
      {children}
    </AppShell>
  );
}

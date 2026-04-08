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
      subtitle="Shared shell for candidate flows. This foundation route already consumes the live dashboard summary endpoint."
    >
      {children}
    </AppShell>
  );
}

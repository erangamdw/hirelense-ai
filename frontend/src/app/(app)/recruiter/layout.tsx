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
      subtitle="Manage jobs, review candidates, upload evidence, and save hiring outputs across each role you are hiring for."
    >
      {children}
    </AppShell>
  );
}

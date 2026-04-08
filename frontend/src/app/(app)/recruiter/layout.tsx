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
      subtitle="Shared shell for recruiter flows. This foundation route already consumes the live recruiter dashboard summary endpoint."
    >
      {children}
    </AppShell>
  );
}

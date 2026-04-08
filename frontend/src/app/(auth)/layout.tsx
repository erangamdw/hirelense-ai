export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-page)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(201,84,38,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(11,89,91,0.18),_transparent_38%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center gap-12 px-4 py-12 md:px-8 lg:flex-row lg:items-center lg:justify-between">
        <section className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.34em] text-[var(--color-ink-soft)]">Frontend foundation</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-[var(--color-ink)]">
            Browser-ready auth and role-aware app shells.
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--color-ink-muted)]">
            This milestone puts a real Next.js surface on top of the existing FastAPI contracts so the next UI slices can focus on product flow, not plumbing.
          </p>
        </section>
        {children}
      </div>
    </div>
  );
}

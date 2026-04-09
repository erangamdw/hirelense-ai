import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Sparkles, UserRound } from "lucide-react";

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[var(--color-page)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(201,84,38,0.18),_transparent_26%),radial-gradient(circle_at_bottom_left,_rgba(11,89,91,0.14),_transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 py-16 md:px-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.36em] text-[var(--color-ink-soft)]">HireLens AI</p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight text-[var(--color-ink)] md:text-7xl">
            The evidence-first workspace for interview preparation and hiring decisions.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-ink-muted)]">
            HireLens AI helps candidates practise for interviews and helps recruiters review candidates against real job requirements using grounded evidence from uploaded documents.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent)] hover:text-white"
            style={{ color: "#ffffff" }}
          >
            <span style={{ color: "#ffffff" }}>Sign in</span>
            <ArrowRight className="h-4 w-4 text-white" />
          </Link>
          <Link
            href="/register"
            className="inline-flex h-12 items-center rounded-full border border-[var(--color-border-strong)] bg-white px-6 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-panel)]"
          >
            Create account
          </Link>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <section className="rounded-[32px] border border-[var(--color-border)] bg-white/90 p-6 shadow-[0_24px_90px_-56px_rgba(13,18,39,0.55)]">
            <Sparkles className="h-6 w-6 text-[var(--color-accent)]" />
            <h2 className="mt-5 text-2xl font-semibold text-[var(--color-ink)]">Candidate prep</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-ink-muted)]">
              Upload your CV, job descriptions, project notes, and feedback, then generate likely questions, answer guidance, STAR stories, and skill-gap insights.
            </p>
          </section>
          <section className="rounded-[32px] border border-[var(--color-border)] bg-white/90 p-6 shadow-[0_24px_90px_-56px_rgba(13,18,39,0.55)]">
            <BriefcaseBusiness className="h-6 w-6 text-[var(--color-teal)]" />
            <h2 className="mt-5 text-2xl font-semibold text-[var(--color-ink)]">Recruiter workspace</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-ink-muted)]">
              Create jobs, attach recruiter-side evidence, generate fit summaries and interview packs, and compare candidates within the same hiring scope.
            </p>
          </section>
          <section className="rounded-[32px] border border-[var(--color-border)] bg-white/90 p-6 shadow-[0_24px_90px_-56px_rgba(13,18,39,0.55)]">
            <UserRound className="h-6 w-6 text-[var(--color-gold)]" />
            <h2 className="mt-5 text-2xl font-semibold text-[var(--color-ink)]">Role-based access</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-ink-muted)]">
              Sign in as a candidate or recruiter and open the workflow that matches your role without mixing documents or report history.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BriefcaseBusiness, FileSearch, LogOut, Sparkles, UserRoundSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import type { UserRole } from "@/lib/api/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Sparkles;
  match: "exact" | "prefix";
};

const candidateNav: NavItem[] = [
  { href: "/candidate", label: "Overview", icon: Sparkles, match: "exact" },
  { href: "/candidate/interview", label: "Assistant", icon: Sparkles, match: "prefix" },
  { href: "/candidate/documents", label: "Documents", icon: FileSearch, match: "prefix" },
  { href: "/candidate/reports", label: "Reports", icon: UserRoundSearch, match: "prefix" },
  { href: "/candidate/profile", label: "Profile", icon: BriefcaseBusiness, match: "prefix" },
];

const recruiterNav: NavItem[] = [
  { href: "/recruiter", label: "Overview", icon: BriefcaseBusiness, match: "exact" },
  { href: "/recruiter/setup", label: "Setup", icon: Sparkles, match: "prefix" },
  { href: "/recruiter/jobs", label: "Jobs", icon: UserRoundSearch, match: "prefix" },
  { href: "/recruiter/reports", label: "Reports", icon: FileSearch, match: "prefix" },
];

function getNav(role: UserRole) {
  return role === "recruiter" ? recruiterNav : candidateNav;
}

export function AppShell({
  children,
  role,
  title,
  subtitle,
}: {
  children: ReactNode;
  role: UserRole;
  title: string;
  subtitle: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const navItems = getNav(role);

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-4 py-4 md:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3 text-[var(--color-ink)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-sm font-bold uppercase tracking-[0.28em] text-white">
              HL
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-ink-soft)]">HireLens AI</p>
              <p className="text-sm font-semibold">{role === "recruiter" ? "Recruiter console" : "Candidate console"}</p>
            </div>
          </Link>

          <nav className="mt-10 flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.match === "exact"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--color-ink)] !text-white shadow-[0_18px_48px_-32px_rgba(21,21,21,0.95)]"
                      : "text-[var(--color-ink-muted)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-ink)]",
                  )}
                  style={isActive ? { color: "#ffffff" } : undefined}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-white" : undefined)} />
                  <span style={isActive ? { color: "#ffffff" } : undefined}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[28px] bg-[var(--color-panel-strong)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Signed in</p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">{user?.full_name || user?.email || "Current user"}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{user?.email}</p>
            <Button
              className="mt-5 w-full"
              variant="secondary"
              onClick={() => {
                signOut();
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="flex-1">
          <div className="rounded-[32px] border border-[var(--color-border)] bg-white/80 p-6 shadow-[0_26px_90px_-54px_rgba(13,18,39,0.5)] backdrop-blur md:p-8">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">Application shell</p>
                <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
              </div>
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

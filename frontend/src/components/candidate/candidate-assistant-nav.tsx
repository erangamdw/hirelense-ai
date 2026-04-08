"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const assistantRoutes = [
  {
    href: "/candidate/interview/questions",
    label: "Likely questions",
    description: "Generate interview prompts tied to your uploaded evidence.",
  },
  {
    href: "/candidate/interview/guidance",
    label: "Answer guidance",
    description: "Draft a stronger spoken answer and likely follow-ups.",
  },
  {
    href: "/candidate/interview/star",
    label: "STAR drafting",
    description: "Turn evidence into an editable STAR response.",
  },
  {
    href: "/candidate/interview/skill-gap",
    label: "Skill gaps",
    description: "Compare your evidence against the target role.",
  },
];

export function CandidateAssistantNav() {
  const pathname = usePathname();

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {assistantRoutes.map((route) => {
        const isActive = pathname === route.href;
        return (
          <Link
            key={route.href}
            href={route.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-[28px] border px-5 py-4 transition-colors",
              isActive
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] !text-white shadow-[0_18px_48px_-32px_rgba(21,21,21,0.95)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-panel)]",
            )}
            style={isActive ? { color: "#ffffff" } : undefined}
          >
            <p
              className={cn("text-sm font-semibold", isActive ? "!text-white" : "text-[var(--color-ink)]")}
              style={isActive ? { color: "#ffffff" } : undefined}
            >
              {route.label}
            </p>
            <p
              className={cn(
                "mt-2 text-sm",
                isActive ? "!text-white" : "text-[var(--color-ink-muted)]",
              )}
              style={isActive ? { color: "rgba(255,255,255,0.82)" } : undefined}
            >
              {route.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

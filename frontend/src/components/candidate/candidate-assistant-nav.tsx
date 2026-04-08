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
            className={cn(
              "rounded-[28px] border px-5 py-4 transition-colors",
              isActive
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-panel)]",
            )}
          >
            <p className="text-sm font-semibold">{route.label}</p>
            <p
              className={cn(
                "mt-2 text-sm",
                isActive ? "text-[var(--color-paper)]/80" : "text-[var(--color-ink-muted)]",
              )}
            >
              {route.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

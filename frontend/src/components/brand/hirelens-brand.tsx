"use client";

import { cn } from "@/lib/utils";

function HireLensMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 72"
      aria-hidden="true"
      className={cn("h-12 w-12", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hirelens-surface" x1="14" y1="12" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0E4D8" />
          <stop offset="1" stopColor="#E0D1C3" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="60" height="60" rx="20" fill="url(#hirelens-surface)" />
      <rect x="6.75" y="6.75" width="58.5" height="58.5" rx="19.25" stroke="rgba(23,38,47,0.08)" />
      <circle cx="31" cy="31" r="14" fill="none" stroke="#173B5C" strokeWidth="4" />
      <path d="M41.5 41.5L51.5 51.5" stroke="#C95426" strokeWidth="6" strokeLinecap="round" />
      <circle cx="31" cy="31" r="5.5" fill="#173B5C" />
    </svg>
  );
}

export function HireLensBrand({
  consoleLabel,
  subtitle = "AI-powered interview and hiring intelligence platform",
  compact = false,
  iconOnly = false,
  className,
}: {
  consoleLabel?: string;
  subtitle?: string;
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <div className={cn("relative shrink-0", className)}>
        <HireLensMark className={compact ? "h-11 w-11" : "h-14 w-14"} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-4 text-[var(--color-ink)]", compact ? "gap-3" : "gap-4", className)}>
      <div className="relative shrink-0">
        <HireLensMark className={compact ? "h-11 w-11" : "h-14 w-14"} />
        <div className="absolute -bottom-1 -right-1 rounded-full border border-white/70 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] shadow-sm">
          AI
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--color-ink-soft)]">
          Hire Lens AI
        </p>
        <h2 className={cn("mt-1 font-semibold text-[var(--color-ink)]", compact ? "text-lg leading-6" : "text-2xl leading-8")}>
          Evidence-first interview intelligence
        </h2>
        <p className={cn("mt-1 max-w-sm text-[var(--color-ink-muted)]", compact ? "text-sm leading-6" : "text-sm leading-7")}>
          {subtitle}
        </p>
        {consoleLabel ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            {consoleLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

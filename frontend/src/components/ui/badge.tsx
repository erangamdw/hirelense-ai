import type React from "react";

import { cn } from "@/lib/utils";

type BadgeProps = React.ComponentProps<"span">;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--color-panel-strong)] px-3 py-1 text-xs font-medium text-[var(--color-ink-muted)]",
        className,
      )}
      {...props}
    />
  );
}

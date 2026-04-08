import type React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-[var(--color-panel-strong)]", className)}
      {...props}
    />
  );
}

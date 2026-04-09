import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EmptyState({
  title,
  message,
  actionHref,
  actionLabel,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--color-ink-muted)]">{message}</p>
        {actionHref && actionLabel ? (
          <Link className={buttonVariants({ className: "text-white hover:text-white" })} href={actionHref} style={{ color: "#ffffff" }}>
            {actionLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

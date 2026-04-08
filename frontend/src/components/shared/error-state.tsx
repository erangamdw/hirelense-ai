import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ErrorState({
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
    <Card className="border-[var(--color-danger)]/30">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--color-ink-muted)]">{message}</p>
        {actionHref && actionLabel ? (
          <Link className={buttonVariants()} href={actionHref}>
            {actionLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

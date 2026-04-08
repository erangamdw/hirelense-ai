import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--color-ink-soft)]">{label}</p>
          <ArrowUpRight className="h-4 w-4 text-[var(--color-ink-soft)]" />
        </div>
        <CardTitle className="text-4xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--color-ink-muted)]">{hint}</p>
      </CardContent>
    </Card>
  );
}

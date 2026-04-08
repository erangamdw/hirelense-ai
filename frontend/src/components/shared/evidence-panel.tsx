import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EvidencePanel({
  items,
}: {
  items: Array<{ label: string; detail: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.detail}`}
            className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3"
          >
            <Badge>{item.label}</Badge>
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{item.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

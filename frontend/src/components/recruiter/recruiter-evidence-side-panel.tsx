import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceChunk } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function buildEvidenceMeta(item: EvidenceChunk) {
  return [
    item.source_label,
    formatLabel(item.document_type),
    item.section_title,
    item.page_number ? `Page ${item.page_number}` : null,
    item.score_note,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function RecruiterEvidenceSidePanel({
  evidence,
}: {
  evidence: EvidenceChunk[];
}) {
  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Evidence references</CardTitle>
        <CardDescription>Source labels, citations, and retrieved snippets for the current recruiter output.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {evidence.length ? (
          evidence.map((item) => (
            <div
              id={`evidence-${item.chunk_id}`}
              key={item.chunk_id}
              className="rounded-3xl border border-[var(--color-border)] bg-white px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{`C${item.chunk_id}`}</Badge>
                <Badge>{formatLabel(item.document_type)}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">{item.source_label}</p>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{buildEvidenceMeta(item)}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--color-ink-muted)]">{item.content}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Generate a recruiter output first to inspect evidence references.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

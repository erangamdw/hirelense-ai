import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEvidenceMetaLine, getEvidenceSourceTitle } from "@/components/shared/evidence-display";
import type { EvidenceChunk } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function buildEvidencePreview(content: string, maxLength = 280) {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength).trimEnd()}...`;
}

export function CandidateEvidenceSidePanel({
  evidence,
  onOpenEvidence,
}: {
  evidence: EvidenceChunk[];
  onOpenEvidence: (chunkId: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence references</CardTitle>
        <CardDescription>
          Source labels, citations, and retrieved snippets for the current generated output.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 xl:max-h-[28rem] xl:overflow-y-auto">
        {evidence.length ? (
          <>
            <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
              The side panel stays compact for scanning. Open full evidence when you need the complete chunk text.
            </p>

            {evidence.map((item) => (
              <div
                id={`evidence-${item.chunk_id}`}
                key={item.chunk_id}
                className="rounded-3xl border border-[var(--color-border)] bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{`C${item.chunk_id}`}</Badge>
                  <Badge>{formatLabel(item.document_type)}</Badge>
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">{getEvidenceSourceTitle(item)}</p>
                {getEvidenceMetaLine(item) ? (
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{getEvidenceMetaLine(item)}</p>
                ) : null}
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-ink-muted)]">
                  {buildEvidencePreview(item.content)}
                </p>
                <div className="mt-4">
                  <Button type="button" variant="secondary" size="sm" onClick={() => onOpenEvidence(item.chunk_id)}>
                    Open full evidence
                  </Button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Generate a result first to inspect retrieved evidence and source labels.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

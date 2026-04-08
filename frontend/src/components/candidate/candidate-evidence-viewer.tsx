"use client";

import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type CandidateEvidenceViewerProps = {
  evidence: EvidenceChunk[];
  activeChunkId: number | null;
  availableChunkIds: number[];
  onClose: () => void;
  onSelectChunk: (chunkId: number) => void;
};

export function CandidateEvidenceViewer({
  evidence,
  activeChunkId,
  availableChunkIds,
  onClose,
  onSelectChunk,
}: CandidateEvidenceViewerProps) {
  const activeEvidence = evidence.find((item) => item.chunk_id === activeChunkId) ?? null;
  const relatedEvidence = availableChunkIds
    .map((chunkId) => evidence.find((item) => item.chunk_id === chunkId) ?? null)
    .filter((item): item is EvidenceChunk => item !== null);

  useEffect(() => {
    if (!activeEvidence) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeEvidence, onClose]);

  if (!activeEvidence) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close evidence viewer"
        className="absolute inset-0 bg-[rgba(14,18,32,0.62)]"
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="candidate-evidence-viewer-title"
          className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_24px_80px_-30px_rgba(27,31,59,0.68)] sm:rounded-[32px]"
        >
          <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                  Evidence viewer
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{`C${activeEvidence.chunk_id}`}</Badge>
                  <Badge>{formatLabel(activeEvidence.document_type)}</Badge>
                  <Badge>{`Chunk ${activeEvidence.chunk_index + 1}`}</Badge>
                </div>
                <h2 id="candidate-evidence-viewer-title" className="text-xl font-semibold text-[var(--color-ink)]">
                  {activeEvidence.source_label}
                </h2>
                <p className="max-w-3xl text-sm text-[var(--color-ink-muted)]">
                  Full source chunk with citation context for the current assistant result.
                </p>
              </div>

              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>

            {relatedEvidence.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedEvidence.map((item) => {
                  const isActive = item.chunk_id === activeEvidence.chunk_id;

                  return (
                    <button
                      key={item.chunk_id}
                      type="button"
                      onClick={() => onSelectChunk(item.chunk_id)}
                      className={
                        isActive
                          ? "rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-semibold text-[var(--color-paper)]"
                          : "rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-border)]"
                      }
                    >
                      {`C${item.chunk_id}`}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid overflow-hidden lg:grid-cols-[0.78fr_1.22fr]">
            <div className="border-b border-[var(--color-border)] bg-white/75 px-5 py-5 lg:border-b-0 lg:border-r lg:px-6">
              <div className="space-y-4 text-sm text-[var(--color-ink-muted)]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                    Source
                  </p>
                  <p className="mt-2 font-medium text-[var(--color-ink)]">{activeEvidence.source_label}</p>
                  <p className="mt-1 leading-6">{buildEvidenceMeta(activeEvidence)}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                    Scope
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{formatLabel(activeEvidence.document_type)}</Badge>
                    {activeEvidence.page_number ? <Badge>{`Page ${activeEvidence.page_number}`}</Badge> : null}
                    {activeEvidence.section_title ? <Badge>{activeEvidence.section_title}</Badge> : null}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                    Retrieval note
                  </p>
                  <p className="mt-2 leading-6">{activeEvidence.score_note}</p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                  Full chunk text
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-ink-muted)]">
                  {activeEvidence.content}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { EvidenceChunk } from "@/lib/api/types";
import { formatLabel } from "@/lib/utils";

function stripSourcePrefix(sourceLabel: string, documentType: string) {
  const prefix = `${documentType}:`;
  if (sourceLabel.startsWith(prefix)) {
    return sourceLabel.slice(prefix.length);
  }
  return sourceLabel;
}

export function getEvidenceSourceTitle(item: EvidenceChunk) {
  const cleaned = stripSourcePrefix(item.source_label, item.document_type).trim();
  return cleaned || formatLabel(item.document_type);
}

export function getEvidenceMetaLine(item: EvidenceChunk) {
  return [
    formatLabel(item.document_type),
    item.section_title,
    item.page_number ? `Page ${item.page_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getEvidenceRetrievalNote(item: EvidenceChunk) {
  if (!item.score_note) {
    return null;
  }

  if (item.score_note.startsWith("Matched source '")) {
    return null;
  }

  return item.score_note;
}

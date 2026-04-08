from __future__ import annotations

import re
from dataclasses import dataclass

from langchain_core.documents import Document as LangChainDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.chunk import Chunk
from app.models.document import Document, DocumentIndexingStatus, DocumentParsingStatus
from app.models.user import User
from app.services.documents.parsing import get_owned_document

PAGE_MARKER_PATTERN = re.compile(r"^\[Page\s+(?P<page>\d+)\]$", re.IGNORECASE)
MARKDOWN_HEADING_PATTERN = re.compile(r"^#{1,6}\s+(?P<title>.+?)\s*$")
COMMON_SECTION_TITLES = {
    "about",
    "achievements",
    "certifications",
    "education",
    "employment",
    "experience",
    "interview feedback",
    "key responsibilities",
    "professional summary",
    "profile",
    "projects",
    "qualifications",
    "requirements",
    "responsibilities",
    "skills",
    "summary",
    "technical skills",
    "work experience",
}


@dataclass(frozen=True)
class ChunkDraft:
    chunk_index: int
    chunk_text: str
    section_title: str | None
    page_number: int | None
    metadata_json: dict[str, object]


class DocumentChunkingError(Exception):
    """Raised when a document cannot be chunked."""


def extract_section_title(line: str) -> str | None:
    markdown_match = MARKDOWN_HEADING_PATTERN.match(line)
    if markdown_match:
        return markdown_match.group("title").strip()

    normalized = line.strip().strip(":")
    lowered = normalized.lower()
    if lowered in COMMON_SECTION_TITLES:
        return normalized.title()

    words = normalized.split()
    if normalized and len(words) <= 6 and normalized.upper() == normalized:
        return normalized.title()

    return None


def build_source_label(document: Document) -> str:
    return f"{document.document_type.value}:{document.original_filename}"


def base_chunk_metadata(document: Document) -> dict[str, object]:
    owner_role = document.owner.role.value if document.owner is not None else None
    metadata: dict[str, object] = {
        "document_id": document.id,
        "document_type": document.document_type.value,
        "owner_role": owner_role,
        "owner_user_id": document.owner_user_id,
        "original_filename": document.original_filename,
        "source_label": build_source_label(document),
    }
    return {key: value for key, value in metadata.items() if value is not None}


def create_langchain_documents(document: Document) -> list[LangChainDocument]:
    if document.parsing_status != DocumentParsingStatus.SUCCEEDED or not document.parsed_text:
        raise DocumentChunkingError("Document must be parsed successfully before chunking.")

    base_metadata = base_chunk_metadata(document)
    langchain_documents: list[LangChainDocument] = []
    current_page: int | None = None
    current_section: str | None = None
    current_lines: list[str] = []

    def flush_current_lines() -> None:
        nonlocal current_lines
        if not current_lines:
            return

        text_body = "\n".join(current_lines).strip()
        if not text_body:
            current_lines = []
            return

        page_content = text_body
        if current_section and not text_body.startswith(current_section):
            page_content = f"{current_section}\n{text_body}"

        metadata = dict(base_metadata)
        if current_page is not None:
            metadata["page_number"] = current_page
        if current_section is not None:
            metadata["section_title"] = current_section

        langchain_documents.append(
            LangChainDocument(
                page_content=page_content,
                metadata=metadata,
            )
        )
        current_lines = []

    for raw_line in document.parsed_text.splitlines():
        line = " ".join(raw_line.split())
        if not line:
            continue

        page_match = PAGE_MARKER_PATTERN.match(line)
        if page_match:
            flush_current_lines()
            current_page = int(page_match.group("page"))
            continue

        section_title = extract_section_title(line)
        if section_title is not None:
            flush_current_lines()
            current_section = section_title
            continue

        current_lines.append(line)

    flush_current_lines()
    if langchain_documents:
        return langchain_documents

    return [
        LangChainDocument(
            page_content=document.parsed_text.strip(),
            metadata=base_metadata,
        )
    ]


def create_text_splitter() -> RecursiveCharacterTextSplitter:
    settings = get_settings()
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.langchain_chunk_size,
        chunk_overlap=settings.langchain_chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        add_start_index=True,
    )


def build_chunk_drafts(document: Document) -> list[ChunkDraft]:
    settings = get_settings()
    split_documents = create_text_splitter().split_documents(create_langchain_documents(document))

    chunk_drafts: list[ChunkDraft] = []
    seen_chunks: set[str] = set()

    for split_document in split_documents:
        normalized_text = " ".join(split_document.page_content.split())
        if not normalized_text:
            continue
        if normalized_text in seen_chunks:
            continue

        metadata = dict(split_document.metadata)
        section_title = metadata.get("section_title")
        page_number = metadata.get("page_number")

        if (
            len(normalized_text) < settings.min_chunk_characters
            and chunk_drafts
            and chunk_drafts[-1].section_title == section_title
            and chunk_drafts[-1].page_number == page_number
        ):
            previous = chunk_drafts[-1]
            merged_text = f"{previous.chunk_text}\n{normalized_text}".strip()
            merged_metadata = dict(previous.metadata_json)
            merged_metadata["chunk_length"] = len(merged_text)
            merged_metadata["merged_small_chunk"] = True
            chunk_drafts[-1] = ChunkDraft(
                chunk_index=previous.chunk_index,
                chunk_text=merged_text,
                section_title=previous.section_title,
                page_number=previous.page_number,
                metadata_json=merged_metadata,
            )
            seen_chunks.add(normalized_text)
            continue

        metadata["chunk_length"] = len(normalized_text)
        metadata["source_document_id"] = document.id
        chunk_drafts.append(
            ChunkDraft(
                chunk_index=len(chunk_drafts),
                chunk_text=normalized_text,
                section_title=section_title if isinstance(section_title, str) else None,
                page_number=page_number if isinstance(page_number, int) else None,
                metadata_json=metadata,
            )
        )
        seen_chunks.add(normalized_text)

    if not chunk_drafts:
        raise DocumentChunkingError("No chunks could be generated from the parsed document text.")

    return chunk_drafts


def chunk_stored_document(db: Session, *, user: User, document_id: int) -> list[Chunk]:
    document = get_owned_document(db, user=user, document_id=document_id)
    drafts = build_chunk_drafts(document)

    db.execute(delete(Chunk).where(Chunk.document_id == document.id))

    chunks = [
        Chunk(
            document_id=document.id,
            chunk_index=draft.chunk_index,
            chunk_text=draft.chunk_text,
            section_title=draft.section_title,
            page_number=draft.page_number,
            metadata_json=draft.metadata_json,
        )
        for draft in drafts
    ]
    db.add_all(chunks)
    document.indexing_status = DocumentIndexingStatus.PENDING
    document.indexing_error = None
    document.indexed_at = None
    db.add(document)
    db.commit()

    for chunk in chunks:
        db.refresh(chunk)

    return chunks

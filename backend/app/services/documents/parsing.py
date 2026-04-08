from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import fitz
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentParsingStatus
from app.models.user import User


@dataclass(frozen=True)
class ParsingResult:
    text: str
    parser_name: str


class DocumentNotFoundError(Exception):
    """Raised when a document cannot be found for the current user."""


class DocumentParsingError(Exception):
    """Raised when a stored document cannot be parsed."""


class DocumentParser(ABC):
    @abstractmethod
    def parse(self, file_path: Path) -> ParsingResult:
        raise NotImplementedError


def normalize_extracted_text(raw_text: str) -> str:
    cleaned_lines: list[str] = []
    for line in raw_text.splitlines():
        normalized = " ".join(line.split())
        if normalized:
            cleaned_lines.append(normalized)
    return "\n".join(cleaned_lines).strip()


class PlainTextDocumentParser(DocumentParser):
    def parse(self, file_path: Path) -> ParsingResult:
        try:
            raw_text = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raw_text = file_path.read_text(encoding="latin-1")

        text = normalize_extracted_text(raw_text)
        if not text:
            raise DocumentParsingError("Parsed text was empty.")
        return ParsingResult(text=text, parser_name="plain_text")


class PdfDocumentParser(DocumentParser):
    def parse(self, file_path: Path) -> ParsingResult:
        with fitz.open(file_path) as pdf:
            page_texts: list[str] = []
            for page_index, page in enumerate(pdf, start=1):
                extracted = normalize_extracted_text(page.get_text("text"))
                if extracted:
                    page_texts.append(f"[Page {page_index}]\n{extracted}")

        text = "\n\n".join(page_texts).strip()
        if not text:
            raise DocumentParsingError("Parsed text was empty.")
        return ParsingResult(text=text, parser_name="pymupdf")


PARSERS_BY_EXTENSION: dict[str, DocumentParser] = {
    ".md": PlainTextDocumentParser(),
    ".pdf": PdfDocumentParser(),
    ".txt": PlainTextDocumentParser(),
}


def get_owned_document(db: Session, *, user: User, document_id: int) -> Document:
    statement = select(Document).where(
        Document.id == document_id,
        Document.owner_user_id == user.id,
    )
    document = db.execute(statement).scalar_one_or_none()
    if document is None:
        raise DocumentNotFoundError("Document was not found for this user.")
    return document


def parse_document_file(file_path: Path) -> ParsingResult:
    parser = PARSERS_BY_EXTENSION.get(file_path.suffix.lower())
    if parser is None:
        raise DocumentParsingError(f"No parser is configured for {file_path.suffix or 'this file type'}.")
    return parser.parse(file_path)


def parse_stored_document(db: Session, *, user: User, document_id: int) -> Document:
    document = get_owned_document(db, user=user, document_id=document_id)
    file_path = Path(document.storage_path)
    if not file_path.exists():
        document.parsing_status = DocumentParsingStatus.FAILED
        document.parsing_error = "Stored file could not be found on disk."
        document.parsed_text = None
        document.parsed_at = None
        db.add(document)
        db.commit()
        db.refresh(document)
        raise DocumentParsingError(document.parsing_error)

    try:
        result = parse_document_file(file_path)
    except Exception as exc:
        error_message = str(exc) or "Unknown parsing error."
        document.parsing_status = DocumentParsingStatus.FAILED
        document.parsing_error = error_message
        document.parsed_text = None
        document.parsed_at = None
        db.add(document)
        db.commit()
        db.refresh(document)
        raise DocumentParsingError(error_message) from exc

    document.parsed_text = result.text
    document.parsing_status = DocumentParsingStatus.SUCCEEDED
    document.parsing_error = None
    document.parsed_at = datetime.now(timezone.utc)
    db.add(document)
    db.commit()
    db.refresh(document)
    return document

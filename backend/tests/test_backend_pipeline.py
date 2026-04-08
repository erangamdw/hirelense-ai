from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path

import fitz
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies import get_db_session
from app.core.config import get_settings
from app.db.base import Base
from app.main import create_app
from app.models.chunk import Chunk
from app.models.document import Document, DocumentIndexingStatus, DocumentParsingStatus
from app.services.providers import EmbeddingProviderError
from app.services.rag.vector_store import build_metadata_filter, get_document_collection


@contextmanager
def build_test_client(
    tmp_path: Path,
    monkeypatch,
    *,
    embedding_provider: str = "deterministic",
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    database_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("VECTOR_DB_PATH", str(tmp_path / "chroma"))
    monkeypatch.setenv("EMBEDDING_PROVIDER", embedding_provider)
    monkeypatch.setenv("LANGCHAIN_CHUNK_SIZE", "300")
    monkeypatch.setenv("LANGCHAIN_CHUNK_OVERLAP", "40")
    monkeypatch.setenv("MIN_CHUNK_CHARACTERS", "40")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("OPENAI_BASE_URL", "")
    get_settings.cache_clear()

    engine = create_engine(
        f"sqlite:///{database_path}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        class_=Session,
    )
    Base.metadata.create_all(engine)

    app = create_app()

    def override_get_db_session() -> Iterator[Session]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db_session] = override_get_db_session

    try:
        with TestClient(app) as client:
            yield client, testing_session_local
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()
        get_settings.cache_clear()


def register_and_login(client: TestClient, *, email: str, role: str = "candidate") -> str:
    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "password123",
            "full_name": "Pipeline Tester",
            "role": role,
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert login_response.status_code == 200
    return login_response.json()["access_token"]


def create_pdf_bytes(*, title: str, body: str) -> bytes:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), f"{title}\n{body}")
    pdf_bytes = pdf.tobytes()
    pdf.close()
    return pdf_bytes


def test_candidate_document_pipeline_happy_path(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, session_factory):
        assert client.get("/health").status_code == 200
        assert client.get("/ready").status_code == 200

        token = register_and_login(client, email="pipeline@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        current_user_response = client.get("/auth/me", headers=headers)
        assert current_user_response.status_code == 200

        profile_response = client.post(
            "/candidate/profile",
            headers=headers,
            json={
                "headline": "Senior Backend Engineer",
                "bio": "Builds APIs and retrieval systems.",
                "location": "Remote",
                "years_experience": 7,
                "target_roles": ["Backend Engineer", "Platform Engineer"],
            },
        )
        assert profile_response.status_code == 201

        upload_response = client.post(
            "/documents/upload",
            headers=headers,
            files={
                "file": (
                    "notes.txt",
                    BytesIO(
                        b"# Summary\nBuilt APIs and retrieval systems.\n\n# Skills\n"
                        b"FastAPI SQLAlchemy LangChain Chroma OpenAI.\n" * 8
                    ),
                    "text/plain",
                )
            },
            data={"document_type": "project_notes"},
        )
        assert upload_response.status_code == 201
        upload_json = upload_response.json()
        document_id = upload_json["id"]
        assert upload_json["indexing_status"] == "pending"

        parse_response = client.post(f"/documents/{document_id}/parse", headers=headers)
        assert parse_response.status_code == 200
        parse_json = parse_response.json()
        assert parse_json["parsing_status"] == DocumentParsingStatus.SUCCEEDED.value
        assert parse_json["indexing_status"] == DocumentIndexingStatus.PENDING.value
        assert parse_json["parsed_text"]

        chunk_response = client.post(f"/documents/{document_id}/chunk", headers=headers)
        assert chunk_response.status_code == 200
        chunk_json = chunk_response.json()
        assert chunk_json["chunk_count"] >= 1

        reindex_response = client.post(f"/documents/{document_id}/reindex", headers=headers)
        assert reindex_response.status_code == 200
        reindex_json = reindex_response.json()
        assert reindex_json["chunk_count"] == chunk_json["chunk_count"]
        assert len(reindex_json["vector_ids"]) == chunk_json["chunk_count"]
        assert reindex_json["indexing_status"] == DocumentIndexingStatus.SUCCEEDED.value

        dashboard_response = client.get("/candidate/dashboard", headers=headers)
        assert dashboard_response.status_code == 200
        dashboard_json = dashboard_response.json()
        assert dashboard_json["has_profile"] is True
        assert dashboard_json["uploaded_document_count"] == 1

        collection = get_document_collection()
        stored_vectors = collection.get(where=build_metadata_filter(document_id=document_id))
        assert len(stored_vectors["ids"]) == chunk_json["chunk_count"]

        with session_factory() as session:
            document = session.execute(select(Document).where(Document.id == document_id)).scalar_one()
            chunks = session.execute(select(Chunk).where(Chunk.document_id == document_id)).scalars().all()
            assert document.indexing_status == DocumentIndexingStatus.SUCCEEDED
            assert document.indexing_error is None
            assert document.indexed_at is not None
            assert all(chunk.embedding_ref for chunk in chunks)


def test_reindex_with_provider_failure_sets_failed_status(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, session_factory):
        monkeypatch.setattr(
            "app.services.documents.indexing.get_embedding_provider",
            lambda: (_ for _ in ()).throw(EmbeddingProviderError("Simulated embedding provider failure.")),
        )
        token = register_and_login(client, email="openai-error@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        upload_response = client.post(
            "/documents/upload",
            headers=headers,
            files={
                "file": (
                    "notes.txt",
                    BytesIO(b"Build systems and retrieval pipelines.\n" * 20),
                    "text/plain",
                )
            },
            data={"document_type": "project_notes"},
        )
        assert upload_response.status_code == 201
        document_id = upload_response.json()["id"]

        assert client.post(f"/documents/{document_id}/parse", headers=headers).status_code == 200
        assert client.post(f"/documents/{document_id}/chunk", headers=headers).status_code == 200

        reindex_response = client.post(f"/documents/{document_id}/reindex", headers=headers)
        assert reindex_response.status_code == 409
        assert reindex_response.json()["detail"] == "Simulated embedding provider failure."

        with session_factory() as session:
            document = session.execute(select(Document).where(Document.id == document_id)).scalar_one()
            chunks = session.execute(select(Chunk).where(Chunk.document_id == document_id)).scalars().all()
            assert document.indexing_status == DocumentIndexingStatus.FAILED
            assert document.indexing_error
            assert document.indexed_at is None
            assert all(chunk.embedding_ref is None for chunk in chunks)


def test_role_aware_retrieval_endpoints_return_filtered_evidence(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        candidate_token = register_and_login(client, email="candidate-retrieval@example.com", role="candidate")
        recruiter_token = register_and_login(client, email="recruiter-retrieval@example.com", role="recruiter")
        candidate_headers = {"Authorization": f"Bearer {candidate_token}"}
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

        candidate_cv_upload = client.post(
            "/documents/upload",
            headers=candidate_headers,
            files={
                "file": (
                    "resume.pdf",
                    BytesIO(create_pdf_bytes(title="Experience", body="Built FastAPI retrieval systems and API backends.")),
                    "application/pdf",
                )
            },
            data={"document_type": "cv"},
        )
        assert candidate_cv_upload.status_code == 201
        candidate_notes_upload = client.post(
            "/documents/upload",
            headers=candidate_headers,
            files={
                "file": (
                    "notes.txt",
                    BytesIO(b"# Projects\nBuilt candidate interview preparation systems with evidence-backed outputs.\n"),
                    "text/plain",
                )
            },
            data={"document_type": "project_notes"},
        )
        assert candidate_notes_upload.status_code == 201

        for document_id in [candidate_cv_upload.json()["id"], candidate_notes_upload.json()["id"]]:
            assert client.post(f"/documents/{document_id}/parse", headers=candidate_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/chunk", headers=candidate_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/reindex", headers=candidate_headers).status_code == 200

        recruiter_upload = client.post(
            "/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "job.txt",
                    BytesIO(b"# Requirements\nNeed FastAPI, SQLAlchemy, and retrieval engineering experience.\n"),
                    "text/plain",
                )
            },
            data={"document_type": "job_description"},
        )
        assert recruiter_upload.status_code == 201
        recruiter_document_id = recruiter_upload.json()["id"]
        assert client.post(f"/documents/{recruiter_document_id}/parse", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{recruiter_document_id}/chunk", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{recruiter_document_id}/reindex", headers=recruiter_headers).status_code == 200

        candidate_retrieval = client.post(
            "/rag/candidate/retrieve",
            headers=candidate_headers,
            json={
                "query": "retrieval systems",
                "document_types": ["cv", "project_notes"],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert candidate_retrieval.status_code == 200
        candidate_evidence = candidate_retrieval.json()["evidence"]
        assert candidate_evidence
        assert all(item["owner_role"] == "candidate" for item in candidate_evidence)
        assert all(item["document_type"] in {"cv", "project_notes"} for item in candidate_evidence)
        assert any(item["document_type"] == "cv" for item in candidate_evidence)
        assert all(item["score_note"] for item in candidate_evidence)

        recruiter_retrieval = client.post(
            "/rag/recruiter/retrieve",
            headers=recruiter_headers,
            json={
                "query": "FastAPI experience",
                "document_types": ["job_description"],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert recruiter_retrieval.status_code == 200
        recruiter_evidence = recruiter_retrieval.json()["evidence"]
        assert recruiter_evidence
        assert all(item["owner_role"] == "recruiter" for item in recruiter_evidence)
        assert all(item["document_type"] == "job_description" for item in recruiter_evidence)
        assert all(item["owner_user_id"] != candidate_evidence[0]["owner_user_id"] for item in recruiter_evidence)

        recruiter_forbidden = client.post(
            "/rag/candidate/retrieve",
            headers=recruiter_headers,
            json={"query": "should fail"},
        )
        assert recruiter_forbidden.status_code == 403


def test_grounded_generation_endpoints_return_answer_and_evidence(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        candidate_token = register_and_login(client, email="candidate-generation@example.com", role="candidate")
        recruiter_token = register_and_login(client, email="recruiter-generation@example.com", role="recruiter")
        candidate_headers = {"Authorization": f"Bearer {candidate_token}"}
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

        candidate_cv_upload = client.post(
            "/documents/upload",
            headers=candidate_headers,
            files={
                "file": (
                    "resume.pdf",
                    BytesIO(
                        create_pdf_bytes(
                            title="Experience",
                            body="Built FastAPI retrieval systems, candidate tooling, and API backends.",
                        )
                    ),
                    "application/pdf",
                )
            },
            data={"document_type": "cv"},
        )
        assert candidate_cv_upload.status_code == 201

        candidate_notes_upload = client.post(
            "/documents/upload",
            headers=candidate_headers,
            files={
                "file": (
                    "notes.txt",
                    BytesIO(
                        b"# Projects\nLed evidence-backed answer generation and retrieval workflows for interview prep.\n"
                    ),
                    "text/plain",
                )
            },
            data={"document_type": "project_notes"},
        )
        assert candidate_notes_upload.status_code == 201

        for document_id in [candidate_cv_upload.json()["id"], candidate_notes_upload.json()["id"]]:
            assert client.post(f"/documents/{document_id}/parse", headers=candidate_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/chunk", headers=candidate_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/reindex", headers=candidate_headers).status_code == 200

        recruiter_upload = client.post(
            "/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "job.txt",
                    BytesIO(
                        b"# Requirements\nNeed FastAPI, retrieval engineering, stakeholder communication, and structured interviewing.\n"
                    ),
                    "text/plain",
                )
            },
            data={"document_type": "job_description"},
        )
        assert recruiter_upload.status_code == 201
        recruiter_document_id = recruiter_upload.json()["id"]
        assert client.post(f"/documents/{recruiter_document_id}/parse", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{recruiter_document_id}/chunk", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{recruiter_document_id}/reindex", headers=recruiter_headers).status_code == 200

        candidate_generation = client.post(
            "/rag/candidate/generate",
            headers=candidate_headers,
            json={
                "query": "How should I explain my FastAPI retrieval experience?",
                "prompt_type": "candidate_answer_guidance",
                "document_types": ["cv", "project_notes"],
                "top_k": 5,
                "score_threshold": 0.0,
                "model_override": "local-guidance-v1",
            },
        )
        assert candidate_generation.status_code == 200
        candidate_generation_json = candidate_generation.json()
        assert candidate_generation_json["provider"] == "deterministic"
        assert candidate_generation_json["model"] == "local-guidance-v1"
        assert candidate_generation_json["evidence_count"] >= 1
        assert len(candidate_generation_json["evidence"]) == candidate_generation_json["evidence_count"]
        assert "Answer outline:" in candidate_generation_json["answer"]
        assert all(item["owner_role"] == "candidate" for item in candidate_generation_json["evidence"])

        recruiter_generation = client.post(
            "/rag/recruiter/generate",
            headers=recruiter_headers,
            json={
                "query": "Summarize the fit for a FastAPI retrieval role.",
                "prompt_type": "recruiter_fit_summary",
                "document_types": ["job_description"],
                "top_k": 5,
                "score_threshold": 0.0,
                "use_upgrade_model": True,
            },
        )
        assert recruiter_generation.status_code == 200
        recruiter_generation_json = recruiter_generation.json()
        assert recruiter_generation_json["provider"] == "deterministic"
        assert recruiter_generation_json["model"] == "deterministic-grounded-v1"
        assert recruiter_generation_json["evidence_count"] >= 1
        assert "Fit summary:" in recruiter_generation_json["answer"]
        assert all(item["owner_role"] == "recruiter" for item in recruiter_generation_json["evidence"])

        invalid_prompt_type = client.post(
            "/rag/candidate/generate",
            headers=candidate_headers,
            json={
                "query": "This should fail",
                "prompt_type": "recruiter_fit_summary",
            },
        )
        assert invalid_prompt_type.status_code == 409
        assert "not available for role 'candidate'" in invalid_prompt_type.json()["detail"]

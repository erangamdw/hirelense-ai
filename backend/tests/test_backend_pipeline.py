from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path

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

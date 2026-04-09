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

        text_document_response = client.post(
            "/documents/text",
            headers=headers,
            json={
                "document_type": "job_description",
                "title": "platform-engineer-jd",
                "content": "Own backend APIs, retrieval quality, and platform reliability.",
            },
        )
        assert text_document_response.status_code == 201

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

        reports_response = client.post(
            "/reports",
            headers=headers,
            json={
                "report_type": "candidate_answer_guidance",
                "query": "Tell me about yourself for platform engineering roles.",
                "title": "Platform intro draft",
                "payload": {"answer_draft": "I build reliable APIs and retrieval systems."},
            },
        )
        assert reports_response.status_code == 201

        list_documents_response = client.get("/documents", headers=headers)
        assert list_documents_response.status_code == 200
        list_documents_json = list_documents_response.json()
        assert len(list_documents_json) == 2
        assert [item["document_type"] for item in list_documents_json] == [
            "job_description",
            "project_notes",
        ]

        dashboard_response = client.get("/candidate/dashboard", headers=headers)
        assert dashboard_response.status_code == 200
        dashboard_json = dashboard_response.json()
        assert dashboard_json["has_profile"] is True
        assert dashboard_json["uploaded_document_count"] == 2
        assert dashboard_json["saved_report_count"] == 1

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


def test_delete_document_removes_record_file_and_vectors(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, session_factory):
        token = register_and_login(client, email="candidate-delete@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        upload_response = client.post(
            "/documents/upload",
            headers=headers,
            files={
                "file": (
                    "resume.pdf",
                    BytesIO(
                        create_pdf_bytes(
                            title="Experience",
                            body="Built FastAPI services, retrieval pipelines, and interview preparation tooling.",
                        )
                    ),
                    "application/pdf",
                )
            },
            data={"document_type": "cv"},
        )
        assert upload_response.status_code == 201
        document_id = upload_response.json()["id"]
        storage_path = Path(upload_response.json()["storage_path"])

        assert client.post(f"/documents/{document_id}/parse", headers=headers).status_code == 200
        assert client.post(f"/documents/{document_id}/chunk", headers=headers).status_code == 200
        assert client.post(f"/documents/{document_id}/reindex", headers=headers).status_code == 200

        collection = get_document_collection()
        stored_vectors_before_delete = collection.get(where=build_metadata_filter(document_id=document_id))
        assert stored_vectors_before_delete["ids"]
        assert storage_path.exists()

        delete_response = client.delete(f"/documents/{document_id}", headers=headers)
        assert delete_response.status_code == 200
        assert delete_response.json() == {"document_id": document_id, "status": "deleted"}

        with session_factory() as session:
            document = session.execute(select(Document).where(Document.id == document_id)).scalar_one_or_none()
            chunks = session.execute(select(Chunk).where(Chunk.document_id == document_id)).scalars().all()
            assert document is None
            assert chunks == []

        stored_vectors_after_delete = collection.get(where=build_metadata_filter(document_id=document_id))
        assert stored_vectors_after_delete["ids"] == []
        assert not storage_path.exists()


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


def test_candidate_generation_can_scope_to_selected_document_ids(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        candidate_token = register_and_login(client, email="candidate-scope@example.com", role="candidate")
        candidate_headers = {"Authorization": f"Bearer {candidate_token}"}

        selected_job_description = client.post(
            "/documents/text",
            headers=candidate_headers,
            json={
                "document_type": "job_description",
                "title": "backend-platform-jd",
                "content": (
                    "Senior backend engineer role focused on FastAPI, PostgreSQL, REST APIs, and platform reliability."
                ),
            },
        )
        assert selected_job_description.status_code == 201
        selected_job_description_id = selected_job_description.json()["id"]

        unselected_job_description = client.post(
            "/documents/text",
            headers=candidate_headers,
            json={
                "document_type": "job_description",
                "title": "frontend-design-jd",
                "content": "Frontend design role focused on Figma systems, motion design, and visual storytelling.",
            },
        )
        assert unselected_job_description.status_code == 201
        unselected_job_description_id = unselected_job_description.json()["id"]

        for document_id in [selected_job_description_id, unselected_job_description_id]:
            assert client.post(f"/documents/{document_id}/parse", headers=candidate_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/chunk", headers=candidate_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/reindex", headers=candidate_headers).status_code == 200

        candidate_questions = client.post(
            "/rag/candidate/interview-questions",
            headers=candidate_headers,
            json={
                "query": "What interview questions should I expect for a FastAPI backend platform role?",
                "document_types": ["job_description"],
                "document_ids": [selected_job_description_id],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert candidate_questions.status_code == 200
        candidate_questions_json = candidate_questions.json()
        assert candidate_questions_json["evidence_count"] >= 1
        assert {item["document_id"] for item in candidate_questions_json["evidence"]} == {selected_job_description_id}
        assert all(
            "frontend-design-jd" not in item["source_label"] for item in candidate_questions_json["evidence"]
        )


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

        candidate_job_upload = client.post(
            "/documents/upload",
            headers=candidate_headers,
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
        assert candidate_job_upload.status_code == 201

        for document_id in [
            candidate_cv_upload.json()["id"],
            candidate_notes_upload.json()["id"],
            candidate_job_upload.json()["id"],
        ]:
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

        recruiter_candidate_upload = client.post(
            "/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "candidate.pdf",
                    BytesIO(
                        create_pdf_bytes(
                            title="Candidate CV",
                            body="Built FastAPI services, retrieval pipelines, and document processing flows for hiring tooling.",
                        )
                    ),
                    "application/pdf",
                )
            },
            data={"document_type": "recruiter_candidate_cv"},
        )
        assert recruiter_candidate_upload.status_code == 201
        recruiter_candidate_document_id = recruiter_candidate_upload.json()["id"]
        assert client.post(f"/documents/{recruiter_candidate_document_id}/parse", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{recruiter_candidate_document_id}/chunk", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{recruiter_candidate_document_id}/reindex", headers=recruiter_headers).status_code == 200

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

        candidate_questions_generation = client.post(
            "/rag/candidate/interview-questions",
            headers=candidate_headers,
            json={
                "query": "Generate likely interview questions for this target role and explain which parts of my background they are probing.",
                "document_types": ["cv", "job_description", "project_notes"],
            },
        )
        assert candidate_questions_generation.status_code == 200
        candidate_questions_generation_json = candidate_questions_generation.json()
        assert candidate_questions_generation_json["evidence_count"] >= 1
        assert len(candidate_questions_generation_json["questions"]) >= 3

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

        recruiter_fit_summary = client.post(
            "/rag/recruiter/fit-summary",
            headers=recruiter_headers,
            json={
                "query": "Summarize the fit for a FastAPI retrieval role.",
                "document_types": ["job_description", "recruiter_candidate_cv"],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert recruiter_fit_summary.status_code == 200
        recruiter_fit_summary_json = recruiter_fit_summary.json()
        assert recruiter_fit_summary_json["evidence_count"] >= 1
        assert "Fit summary:" in recruiter_fit_summary_json["summary"]
        assert recruiter_fit_summary_json["strengths"]
        assert recruiter_fit_summary_json["concerns"]
        assert recruiter_fit_summary_json["missing_evidence_areas"]
        assert recruiter_fit_summary_json["recommendation"]

        recruiter_interview_pack = client.post(
            "/rag/recruiter/interview-pack",
            headers=recruiter_headers,
            json={
                "query": "Build an interview pack for a FastAPI retrieval role.",
                "document_types": ["job_description", "recruiter_candidate_cv"],
                "top_k": 5,
                "score_threshold": 0.0,
                "use_upgrade_model": True,
            },
        )
        assert recruiter_interview_pack.status_code == 200
        recruiter_interview_pack_json = recruiter_interview_pack.json()
        assert recruiter_interview_pack_json["evidence_count"] >= 1
        assert "Interview pack:" in recruiter_interview_pack_json["overview"]
        assert len(recruiter_interview_pack_json["probes"]) >= 3
        assert recruiter_interview_pack_json["follow_up_questions"]
        assert all(item["rationale"] for item in recruiter_interview_pack_json["probes"])
        assert all(item["evidence_chunk_ids"] for item in recruiter_interview_pack_json["probes"])

        candidate_questions = client.post(
            "/rag/candidate/interview-questions",
            headers=candidate_headers,
            json={
                "query": "How should I prepare for a FastAPI retrieval interview?",
                "document_types": ["cv", "project_notes", "job_description"],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert candidate_questions.status_code == 200
        candidate_questions_json = candidate_questions.json()
        assert candidate_questions_json["evidence_count"] >= 1
        assert len(candidate_questions_json["questions"]) >= 3
        assert "Likely interview questions:" in candidate_questions_json["overview"]
        assert any(item["category"] == "requirements" for item in candidate_questions_json["questions"])
        assert all(item["evidence_chunk_ids"] for item in candidate_questions_json["questions"])

        candidate_guidance = client.post(
            "/rag/candidate/answer-guidance",
            headers=candidate_headers,
            json={
                "query": "How do I explain my retrieval engineering experience clearly?",
                "document_types": ["cv", "project_notes", "job_description"],
                "top_k": 5,
                "score_threshold": 0.0,
                "use_upgrade_model": True,
            },
        )
        assert candidate_guidance.status_code == 200
        candidate_guidance_json = candidate_guidance.json()
        assert candidate_guidance_json["evidence_count"] >= 1
        assert candidate_guidance_json["opening_answer"]
        assert candidate_guidance_json["talking_points"]
        assert candidate_guidance_json["stronger_version_tip"]
        assert len(candidate_guidance_json["follow_up_questions"]) >= 2
        assert "Answer outline:" in candidate_guidance_json["answer_draft"]

        candidate_star = client.post(
            "/rag/candidate/star-answer",
            headers=candidate_headers,
            json={
                "query": "Tell me about a time you built a retrieval workflow.",
                "document_types": ["cv", "project_notes", "job_description"],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert candidate_star.status_code == 200
        candidate_star_json = candidate_star.json()
        assert candidate_star_json["evidence_count"] >= 1
        assert candidate_star_json["situation"]["content"]
        assert candidate_star_json["task"]["content"]
        assert candidate_star_json["action"]["content"]
        assert candidate_star_json["result"]["content"]
        assert "Situation:" in candidate_star_json["editable_draft"]
        assert "Task:" in candidate_star_json["editable_draft"]
        assert len(candidate_star_json["missing_signals"]) >= 1

        candidate_skill_gap = client.post(
            "/rag/candidate/skill-gap-analysis",
            headers=candidate_headers,
            json={
                "query": "Where are my gaps for this FastAPI retrieval role?",
                "document_types": ["cv", "project_notes", "job_description"],
                "top_k": 5,
                "score_threshold": 0.0,
                "use_upgrade_model": True,
            },
        )
        assert candidate_skill_gap.status_code == 200
        candidate_skill_gap_json = candidate_skill_gap.json()
        assert candidate_skill_gap_json["evidence_count"] >= 1
        assert "Skill-gap analysis:" in candidate_skill_gap_json["analysis_summary"]
        assert candidate_skill_gap_json["strengths"]
        assert candidate_skill_gap_json["missing_signals"]
        assert candidate_skill_gap_json["improvement_actions"]
        assert any(item["severity"] == "high" for item in candidate_skill_gap_json["missing_signals"])
        assert all(item["recommendation"] for item in candidate_skill_gap_json["missing_signals"])

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


def test_saved_report_endpoints_persist_and_scope_outputs(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        candidate_token = register_and_login(client, email="candidate-reports@example.com", role="candidate")
        recruiter_token = register_and_login(client, email="recruiter-reports@example.com", role="recruiter")
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
                            body="Built FastAPI retrieval systems and candidate interview preparation tooling.",
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
                    BytesIO(b"# Projects\nBuilt evidence-backed answer guidance and question generation flows.\n"),
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

        recruiter_job_upload = client.post(
            "/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "job.txt",
                    BytesIO(b"# Requirements\nNeed FastAPI, retrieval systems, and structured interviewing.\n"),
                    "text/plain",
                )
            },
            data={"document_type": "job_description"},
        )
        assert recruiter_job_upload.status_code == 201
        recruiter_candidate_upload = client.post(
            "/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "candidate.pdf",
                    BytesIO(
                        create_pdf_bytes(
                            title="Candidate CV",
                            body="Built FastAPI services and retrieval tooling for hiring workflows.",
                        )
                    ),
                    "application/pdf",
                )
            },
            data={"document_type": "recruiter_candidate_cv"},
        )
        assert recruiter_candidate_upload.status_code == 201

        for document_id in [recruiter_job_upload.json()["id"], recruiter_candidate_upload.json()["id"]]:
            assert client.post(f"/documents/{document_id}/parse", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/chunk", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/reindex", headers=recruiter_headers).status_code == 200

        candidate_questions = client.post(
            "/rag/candidate/interview-questions",
            headers=candidate_headers,
            json={
                "query": "What questions should I expect for a FastAPI retrieval role?",
                "document_types": ["cv", "project_notes"],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert candidate_questions.status_code == 200

        save_candidate_report = client.post(
            "/reports",
            headers=candidate_headers,
            json={
                "report_type": "candidate_interview_questions",
                "query": "What questions should I expect for a FastAPI retrieval role?",
                "payload": candidate_questions.json(),
            },
        )
        assert save_candidate_report.status_code == 201
        save_candidate_report_json = save_candidate_report.json()
        assert save_candidate_report_json["report_type"] == "candidate_interview_questions"
        assert save_candidate_report_json["payload"]["questions"]
        assert save_candidate_report_json["title"].startswith("Candidate Interview Questions:")

        recruiter_fit_summary = client.post(
            "/rag/recruiter/fit-summary",
            headers=recruiter_headers,
            json={
                "query": "Summarize the fit for a FastAPI retrieval role.",
                "document_types": ["job_description", "recruiter_candidate_cv"],
                "top_k": 5,
                "score_threshold": 0.0,
            },
        )
        assert recruiter_fit_summary.status_code == 200

        save_recruiter_report = client.post(
            "/reports",
            headers=recruiter_headers,
            json={
                "report_type": "recruiter_fit_summary",
                "query": "Summarize the fit for a FastAPI retrieval role.",
                "payload": recruiter_fit_summary.json(),
                "title": "FastAPI Retrieval Screen",
            },
        )
        assert save_recruiter_report.status_code == 201
        recruiter_report_id = save_recruiter_report.json()["id"]

        candidate_history = client.get("/reports", headers=candidate_headers)
        assert candidate_history.status_code == 200
        candidate_history_json = candidate_history.json()
        assert candidate_history_json["total"] == 1
        assert candidate_history_json["items"][0]["report_type"] == "candidate_interview_questions"

        filtered_candidate_history = client.get(
            "/reports",
            headers=candidate_headers,
            params={"report_type": "candidate_interview_questions"},
        )
        assert filtered_candidate_history.status_code == 200
        assert filtered_candidate_history.json()["total"] == 1

        candidate_detail = client.get(
            f"/reports/{save_candidate_report_json['id']}",
            headers=candidate_headers,
        )
        assert candidate_detail.status_code == 200
        candidate_detail_json = candidate_detail.json()
        assert candidate_detail_json["payload"]["query"] == "What questions should I expect for a FastAPI retrieval role?"

        candidate_wrong_type = client.post(
            "/reports",
            headers=candidate_headers,
            json={
                "report_type": "recruiter_fit_summary",
                "query": "This should fail",
                "payload": {"summary": "invalid"},
            },
        )
        assert candidate_wrong_type.status_code == 409
        assert "not available for role 'candidate'" in candidate_wrong_type.json()["detail"]

        recruiter_history = client.get("/reports", headers=recruiter_headers)
        assert recruiter_history.status_code == 200
        recruiter_history_json = recruiter_history.json()
        assert recruiter_history_json["total"] == 1
        assert recruiter_history_json["items"][0]["title"] == "FastAPI Retrieval Screen"

        recruiter_detail = client.get(f"/reports/{recruiter_report_id}", headers=recruiter_headers)
        assert recruiter_detail.status_code == 200
        assert recruiter_detail.json()["payload"]["recommendation"]

        recruiter_cannot_read_candidate_report = client.get(
            f"/reports/{save_candidate_report_json['id']}",
            headers=recruiter_headers,
        )
        assert recruiter_cannot_read_candidate_report.status_code == 404


def test_recruiter_job_and_candidate_intake_endpoints_link_documents(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, session_factory):
        recruiter_token = register_and_login(client, email="recruiter-jobs@example.com", role="recruiter")
        other_recruiter_token = register_and_login(
            client,
            email="other-recruiter-jobs@example.com",
            role="recruiter",
        )
        candidate_token = register_and_login(client, email="candidate-forbidden@example.com", role="candidate")
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}
        other_recruiter_headers = {"Authorization": f"Bearer {other_recruiter_token}"}
        candidate_headers = {"Authorization": f"Bearer {candidate_token}"}

        create_job_response = client.post(
            "/recruiter/jobs",
            headers=recruiter_headers,
            json={
                "title": "Senior Retrieval Engineer",
                "description": "Own FastAPI APIs, document parsing, retrieval pipelines, and interview signal design.",
                "seniority": "senior",
                "location": "Remote",
                "skills_required": ["FastAPI", "SQLAlchemy", "LangChain", "Chroma"],
            },
        )
        assert create_job_response.status_code == 201
        create_job_json = create_job_response.json()
        job_id = create_job_json["id"]
        assert create_job_json["candidate_count"] == 0
        assert create_job_json["linked_document_count"] == 0

        list_jobs_response = client.get("/recruiter/jobs", headers=recruiter_headers)
        assert list_jobs_response.status_code == 200
        list_jobs_json = list_jobs_response.json()
        assert list_jobs_json["total"] == 1
        assert list_jobs_json["items"][0]["title"] == "Senior Retrieval Engineer"

        candidate_one_response = client.post(
            f"/recruiter/jobs/{job_id}/candidates",
            headers=recruiter_headers,
            json={
                "full_name": "Jordan Candidate",
                "email": "jordan@example.com",
                "current_title": "Backend Engineer",
                "notes": "Strong API delivery background. Need to verify retrieval depth.",
            },
        )
        assert candidate_one_response.status_code == 201
        candidate_one_id = candidate_one_response.json()["id"]
        assert candidate_one_response.json()["document_count"] == 0

        candidate_two_response = client.post(
            f"/recruiter/jobs/{job_id}/candidates",
            headers=recruiter_headers,
            json={
                "full_name": "Alex Candidate",
                "notes": "Second pipeline for comparison.",
            },
        )
        assert candidate_two_response.status_code == 201

        job_document_upload = client.post(
            f"/recruiter/jobs/{job_id}/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "job.txt",
                    BytesIO(
                        b"# Requirements\nNeed FastAPI ownership, retrieval architecture, and evidence-backed interviewing.\n"
                    ),
                    "text/plain",
                )
            },
            data={"document_type": "job_description"},
        )
        assert job_document_upload.status_code == 201
        job_document_id = job_document_upload.json()["id"]
        assert job_document_upload.json()["recruiter_job_id"] == job_id
        assert job_document_upload.json()["recruiter_candidate_id"] is None

        candidate_document_upload = client.post(
            f"/recruiter/jobs/{job_id}/candidates/{candidate_one_id}/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "candidate.pdf",
                    BytesIO(
                        create_pdf_bytes(
                            title="Candidate CV",
                            body="Built FastAPI services, chunking pipelines, and hiring workflow tooling.",
                        )
                    ),
                    "application/pdf",
                )
            },
            data={"document_type": "recruiter_candidate_cv"},
        )
        assert candidate_document_upload.status_code == 201
        candidate_document_id = candidate_document_upload.json()["id"]
        assert candidate_document_upload.json()["recruiter_job_id"] == job_id
        assert candidate_document_upload.json()["recruiter_candidate_id"] == candidate_one_id

        assert client.post(f"/documents/{job_document_id}/parse", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{job_document_id}/chunk", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{job_document_id}/reindex", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{candidate_document_id}/parse", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{candidate_document_id}/chunk", headers=recruiter_headers).status_code == 200
        assert client.post(f"/documents/{candidate_document_id}/reindex", headers=recruiter_headers).status_code == 200

        job_detail_response = client.get(f"/recruiter/jobs/{job_id}", headers=recruiter_headers)
        assert job_detail_response.status_code == 200
        job_detail_json = job_detail_response.json()
        assert job_detail_json["candidate_count"] == 2
        assert job_detail_json["linked_document_count"] == 2
        assert len(job_detail_json["candidates"]) == 2
        assert job_detail_json["candidates"][0]["document_count"] in {0, 1}
        matching_candidate = next(item for item in job_detail_json["candidates"] if item["id"] == candidate_one_id)
        assert matching_candidate["document_count"] == 1
        assert matching_candidate["notes"] == "Strong API delivery background. Need to verify retrieval depth."

        invalid_candidate_upload = client.post(
            f"/recruiter/jobs/{job_id}/candidates/{candidate_one_id}/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "wrong.txt",
                    BytesIO(b"Should fail for candidate upload."),
                    "text/plain",
                )
            },
            data={"document_type": "project_notes"},
        )
        assert invalid_candidate_upload.status_code == 409
        assert "not supported for recruiter candidate uploads" in invalid_candidate_upload.json()["detail"]

        other_recruiter_job_access = client.get(f"/recruiter/jobs/{job_id}", headers=other_recruiter_headers)
        assert other_recruiter_job_access.status_code == 404

        candidate_forbidden = client.get("/recruiter/jobs", headers=candidate_headers)
        assert candidate_forbidden.status_code == 403

        with session_factory() as session:
            job_document = session.execute(select(Document).where(Document.id == job_document_id)).scalar_one()
            candidate_document = session.execute(
                select(Document).where(Document.id == candidate_document_id)
            ).scalar_one()
            assert job_document.recruiter_job_id == job_id
            assert job_document.recruiter_candidate_id is None
            assert candidate_document.recruiter_job_id == job_id
            assert candidate_document.recruiter_candidate_id == candidate_one_id
            assert candidate_document.parsing_status == DocumentParsingStatus.SUCCEEDED
            assert candidate_document.indexing_status == DocumentIndexingStatus.SUCCEEDED


def test_recruiter_profile_endpoints_persist_profile_data(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        recruiter_token = register_and_login(client, email="recruiter-profile@example.com", role="recruiter")
        candidate_token = register_and_login(client, email="candidate-profile-block@example.com", role="candidate")
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}
        candidate_headers = {"Authorization": f"Bearer {candidate_token}"}

        missing_profile = client.get("/recruiter/profile", headers=recruiter_headers)
        assert missing_profile.status_code == 404

        create_profile = client.post(
            "/recruiter/profile",
            headers=recruiter_headers,
            json={
                "company_name": "  Acme Hiring  ",
                "recruiter_type": "agency",
                "organisation_size": " 50-200 employees ",
            },
        )
        assert create_profile.status_code == 201
        create_profile_json = create_profile.json()
        assert create_profile_json["company_name"] == "Acme Hiring"
        assert create_profile_json["recruiter_type"] == "agency"
        assert create_profile_json["organisation_size"] == "50-200 employees"

        duplicate_create = client.post(
            "/recruiter/profile",
            headers=recruiter_headers,
            json={
                "company_name": "Another company",
                "recruiter_type": "in_house",
            },
        )
        assert duplicate_create.status_code == 409

        get_profile = client.get("/recruiter/profile", headers=recruiter_headers)
        assert get_profile.status_code == 200
        assert get_profile.json()["company_name"] == "Acme Hiring"

        update_profile = client.put(
            "/recruiter/profile",
            headers=recruiter_headers,
            json={
                "company_name": "Acme Talent",
                "recruiter_type": "hiring_manager",
                "organisation_size": "",
            },
        )
        assert update_profile.status_code == 200
        update_profile_json = update_profile.json()
        assert update_profile_json["company_name"] == "Acme Talent"
        assert update_profile_json["recruiter_type"] == "hiring_manager"
        assert update_profile_json["organisation_size"] is None

        invalid_company = client.put(
            "/recruiter/profile",
            headers=recruiter_headers,
            json={
                "company_name": " ",
                "recruiter_type": "agency",
            },
        )
        assert invalid_company.status_code == 422

        candidate_blocked = client.get("/recruiter/profile", headers=candidate_headers)
        assert candidate_blocked.status_code == 403


def test_recruiter_candidate_comparison_endpoint_and_status_updates(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        recruiter_token = register_and_login(client, email="recruiter-compare@example.com", role="recruiter")
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

        job_response = client.post(
            "/recruiter/jobs",
            headers=recruiter_headers,
            json={
                "title": "Platform Retrieval Engineer",
                "description": "Own retrieval APIs and interview signal quality.",
                "skills_required": ["FastAPI", "Chroma"],
            },
        )
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]

        candidate_one = client.post(
            f"/recruiter/jobs/{job_id}/candidates",
            headers=recruiter_headers,
            json={
                "full_name": "Jordan Strong",
                "current_title": "Senior Backend Engineer",
                "notes": "Looks promising for retrieval-heavy work.",
            },
        )
        assert candidate_one.status_code == 201
        candidate_one_id = candidate_one.json()["id"]

        candidate_two = client.post(
            f"/recruiter/jobs/{job_id}/candidates",
            headers=recruiter_headers,
            json={
                "full_name": "Alex Needs Review",
                "current_title": "Backend Engineer",
            },
        )
        assert candidate_two.status_code == 201
        candidate_two_id = candidate_two.json()["id"]

        save_fit_summary = client.post(
            "/reports",
            headers=recruiter_headers,
            json={
                "report_type": "recruiter_fit_summary",
                "query": "Summarize Jordan Strong for the retrieval role.",
                "recruiter_candidate_id": candidate_one_id,
                "payload": {
                    "summary": "Jordan shows strong retrieval-system ownership and solid evidence-backed hiring workflow experience.",
                    "recommendation": "Move this candidate to shortlist and probe scale details in the interview.",
                    "missing_evidence_areas": ["Very large-scale production traffic"],
                    "strengths": [
                        {
                            "title": "Retrieval ownership",
                            "summary": "Built and maintained retrieval APIs and grounding flows.",
                            "evidence_chunk_ids": [11, 12],
                        }
                    ],
                    "concerns": [
                        {
                            "title": "Scale depth",
                            "summary": "Need clearer proof of production scale under heavy traffic.",
                            "evidence_chunk_ids": [13],
                        }
                    ],
                },
            },
        )
        assert save_fit_summary.status_code == 201
        fit_summary_report_id = save_fit_summary.json()["id"]

        comparison_response = client.get(f"/recruiter/jobs/{job_id}/comparison", headers=recruiter_headers)
        assert comparison_response.status_code == 200
        comparison_json = comparison_response.json()
        assert comparison_json["job_id"] == job_id
        assert comparison_json["candidate_count"] == 2
        assert comparison_json["ranking_basis"]
        assert comparison_json["candidates"][0]["candidate_id"] == candidate_one_id
        assert comparison_json["candidates"][0]["rank_position"] == 1
        assert comparison_json["candidates"][0]["latest_fit_summary_report_id"] == fit_summary_report_id
        assert comparison_json["candidates"][0]["fit_summary_summary"]
        assert comparison_json["candidates"][0]["overall_match_score"] >= 0
        assert comparison_json["candidates"][0]["skill_match"]["title"] == "Skill match"
        assert comparison_json["candidates"][0]["tech_stack_match"]["title"] == "Tech stack match"
        assert comparison_json["candidates"][0]["qualification_match"]["title"] == "Qualifications"
        assert comparison_json["candidates"][0]["experience_match"]["title"] == "Experience"
        assert comparison_json["candidates"][0]["strengths"]
        assert comparison_json["candidates"][0]["concerns"]
        assert comparison_json["candidates"][0]["needs_fit_summary"] is False
        assert comparison_json["candidates"][1]["candidate_id"] == candidate_two_id
        assert comparison_json["candidates"][1]["rank_position"] == 2
        assert comparison_json["candidates"][1]["needs_fit_summary"] is True
        assert comparison_json["candidates"][1]["shortlist_status"] == "under_review"

        status_update_response = client.patch(
            f"/recruiter/jobs/{job_id}/candidates/{candidate_one_id}/status",
            headers=recruiter_headers,
            json={"shortlist_status": "shortlisted"},
        )
        assert status_update_response.status_code == 200
        assert status_update_response.json()["shortlist_status"] == "shortlisted"

        comparison_after_status_update = client.get(f"/recruiter/jobs/{job_id}/comparison", headers=recruiter_headers)
        assert comparison_after_status_update.status_code == 200
        comparison_after_status_update_json = comparison_after_status_update.json()
        updated_candidate = next(
            item
            for item in comparison_after_status_update_json["candidates"]
            if item["candidate_id"] == candidate_one_id
        )
        assert updated_candidate["shortlist_status"] == "shortlisted"


def test_recruiter_job_delete_removes_scoped_candidates_documents_reports_and_vectors(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, session_factory):
        recruiter_token = register_and_login(client, email="recruiter-delete-job@example.com", role="recruiter")
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

        create_job_response = client.post(
            "/recruiter/jobs",
            headers=recruiter_headers,
            json={
                "title": "Backend Platform Engineer",
                "description": "Own platform APIs and retrieval reliability.",
                "skills_required": ["FastAPI", "PostgreSQL"],
            },
        )
        assert create_job_response.status_code == 201
        job_id = create_job_response.json()["id"]

        create_candidate_response = client.post(
            f"/recruiter/jobs/{job_id}/candidates",
            headers=recruiter_headers,
            json={"full_name": "Taylor Delete", "current_title": "Platform Engineer"},
        )
        assert create_candidate_response.status_code == 201
        candidate_id = create_candidate_response.json()["id"]

        job_document_upload = client.post(
            f"/recruiter/jobs/{job_id}/documents/upload",
            headers=recruiter_headers,
            files={"file": ("job.txt", BytesIO(b"Need FastAPI and PostgreSQL experience."), "text/plain")},
            data={"document_type": "job_description"},
        )
        assert job_document_upload.status_code == 201
        job_document_id = job_document_upload.json()["id"]
        job_storage_path = Path(job_document_upload.json()["storage_path"])

        candidate_document_upload = client.post(
            f"/recruiter/jobs/{job_id}/candidates/{candidate_id}/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "candidate.txt",
                    BytesIO(b"Built FastAPI APIs and PostgreSQL-backed services for hiring systems."),
                    "text/plain",
                )
            },
            data={"document_type": "interview_feedback"},
        )
        assert candidate_document_upload.status_code == 201
        candidate_document_id = candidate_document_upload.json()["id"]
        candidate_storage_path = Path(candidate_document_upload.json()["storage_path"])

        for document_id in [job_document_id, candidate_document_id]:
            assert client.post(f"/documents/{document_id}/parse", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/chunk", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/reindex", headers=recruiter_headers).status_code == 200

        report_response = client.post(
            "/reports",
            headers=recruiter_headers,
            json={
                "report_type": "recruiter_fit_summary",
                "query": "Assess Taylor for the backend platform role.",
                "recruiter_candidate_id": candidate_id,
                "payload": {"summary": "Strong backend platform alignment."},
            },
        )
        assert report_response.status_code == 201

        collection = get_document_collection()
        assert collection.get(where=build_metadata_filter(document_id=job_document_id))["ids"]
        assert collection.get(where=build_metadata_filter(document_id=candidate_document_id))["ids"]
        assert job_storage_path.exists()
        assert candidate_storage_path.exists()

        delete_response = client.delete(f"/recruiter/jobs/{job_id}", headers=recruiter_headers)
        assert delete_response.status_code == 200
        assert delete_response.json() == {"job_id": job_id, "status": "deleted"}

        with session_factory() as session:
            assert session.execute(select(Document).where(Document.id == job_document_id)).scalar_one_or_none() is None
            assert session.execute(select(Document).where(Document.id == candidate_document_id)).scalar_one_or_none() is None
            assert session.execute(select(Chunk).where(Chunk.document_id == job_document_id)).scalars().all() == []
            assert session.execute(select(Chunk).where(Chunk.document_id == candidate_document_id)).scalars().all() == []

        assert collection.get(where=build_metadata_filter(document_id=job_document_id))["ids"] == []
        assert collection.get(where=build_metadata_filter(document_id=candidate_document_id))["ids"] == []
        assert not job_storage_path.exists()
        assert not candidate_storage_path.exists()


def test_recruiter_job_update_endpoint_persists_changes(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        recruiter_token = register_and_login(client, email="recruiter-edit@example.com", role="recruiter")
        other_recruiter_token = register_and_login(
            client,
            email="other-recruiter-edit@example.com",
            role="recruiter",
        )
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}
        other_recruiter_headers = {"Authorization": f"Bearer {other_recruiter_token}"}

        create_job_response = client.post(
            "/recruiter/jobs",
            headers=recruiter_headers,
            json={
                "title": "Backend Engineer",
                "description": "Own APIs and platform tooling.",
                "seniority": "mid",
                "location": "Remote",
                "skills_required": ["FastAPI", "SQLAlchemy"],
            },
        )
        assert create_job_response.status_code == 201
        job_id = create_job_response.json()["id"]

        update_job_response = client.put(
            f"/recruiter/jobs/{job_id}",
            headers=recruiter_headers,
            json={
                "title": "Senior Backend Engineer",
                "description": "Own APIs, retrieval quality, and platform reliability.",
                "seniority": "senior",
                "location": "London or Remote",
                "skills_required": ["FastAPI", "SQLAlchemy", "Chroma"],
            },
        )
        assert update_job_response.status_code == 200
        update_job_json = update_job_response.json()
        assert update_job_json["title"] == "Senior Backend Engineer"
        assert update_job_json["description"] == "Own APIs, retrieval quality, and platform reliability."
        assert update_job_json["seniority"] == "senior"
        assert update_job_json["location"] == "London or Remote"
        assert update_job_json["skills_required"] == ["FastAPI", "SQLAlchemy", "Chroma"]

        job_detail_response = client.get(f"/recruiter/jobs/{job_id}", headers=recruiter_headers)
        assert job_detail_response.status_code == 200
        job_detail_json = job_detail_response.json()
        assert job_detail_json["title"] == "Senior Backend Engineer"
        assert job_detail_json["skills_required"] == ["FastAPI", "SQLAlchemy", "Chroma"]

        other_recruiter_update_response = client.put(
            f"/recruiter/jobs/{job_id}",
            headers=other_recruiter_headers,
            json={
                "title": "Should Fail",
                "description": "Should not update another recruiter's job.",
                "skills_required": [],
            },
        )
        assert other_recruiter_update_response.status_code == 404


def test_recruiter_scoped_retrieval_and_report_history_filters(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        recruiter_token = register_and_login(client, email="recruiter-scope@example.com", role="recruiter")
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

        job_one = client.post(
            "/recruiter/jobs",
            headers=recruiter_headers,
            json={
                "title": "FastAPI Retrieval Engineer",
                "description": "Own retrieval pipelines and evidence-backed screening.",
                "skills_required": ["FastAPI", "Chroma"],
            },
        )
        assert job_one.status_code == 201
        job_one_id = job_one.json()["id"]

        job_two = client.post(
            "/recruiter/jobs",
            headers=recruiter_headers,
            json={
                "title": "Frontend Platform Engineer",
                "description": "Own frontend systems and DX improvements.",
                "skills_required": ["Next.js", "TypeScript"],
            },
        )
        assert job_two.status_code == 201
        job_two_id = job_two.json()["id"]

        candidate_one = client.post(
            f"/recruiter/jobs/{job_one_id}/candidates",
            headers=recruiter_headers,
            json={"full_name": "Jordan Retrieval", "notes": "Primary retrieval candidate."},
        )
        assert candidate_one.status_code == 201
        candidate_one_id = candidate_one.json()["id"]

        candidate_two = client.post(
            f"/recruiter/jobs/{job_two_id}/candidates",
            headers=recruiter_headers,
            json={"full_name": "Alex Frontend", "notes": "Different job and candidate."},
        )
        assert candidate_two.status_code == 201
        candidate_two_id = candidate_two.json()["id"]

        uploads = [
            client.post(
                f"/recruiter/jobs/{job_one_id}/documents/upload",
                headers=recruiter_headers,
                files={
                    "file": (
                        "job-one.txt",
                        BytesIO(b"# Requirements\nNeed FastAPI retrieval systems and evidence-backed hiring workflows.\n"),
                        "text/plain",
                    )
                },
                data={"document_type": "job_description"},
            ),
            client.post(
                f"/recruiter/jobs/{job_one_id}/candidates/{candidate_one_id}/documents/upload",
                headers=recruiter_headers,
                files={
                    "file": (
                        "candidate-one.pdf",
                        BytesIO(
                            create_pdf_bytes(
                                title="Candidate One",
                                body="Built FastAPI retrieval systems and hiring workflow tooling.",
                            )
                        ),
                        "application/pdf",
                    )
                },
                data={"document_type": "recruiter_candidate_cv"},
            ),
            client.post(
                f"/recruiter/jobs/{job_two_id}/documents/upload",
                headers=recruiter_headers,
                files={
                    "file": (
                        "job-two.txt",
                        BytesIO(b"# Requirements\nNeed Next.js, TypeScript, and design systems.\n"),
                        "text/plain",
                    )
                },
                data={"document_type": "job_description"},
            ),
            client.post(
                f"/recruiter/jobs/{job_two_id}/candidates/{candidate_two_id}/documents/upload",
                headers=recruiter_headers,
                files={
                    "file": (
                        "candidate-two.pdf",
                        BytesIO(
                            create_pdf_bytes(
                                title="Candidate Two",
                                body="Built frontend platforms with Next.js and TypeScript.",
                            )
                        ),
                        "application/pdf",
                    )
                },
                data={"document_type": "recruiter_candidate_cv"},
            ),
        ]
        for upload in uploads:
            assert upload.status_code == 201
            document_id = upload.json()["id"]
            assert client.post(f"/documents/{document_id}/parse", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/chunk", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/reindex", headers=recruiter_headers).status_code == 200

        scoped_retrieval = client.post(
            "/rag/recruiter/retrieve",
            headers=recruiter_headers,
            json={
                "query": "retrieval systems",
                "document_types": ["job_description", "recruiter_candidate_cv"],
                "top_k": 5,
                "score_threshold": 0.0,
                "recruiter_job_id": job_one_id,
                "recruiter_candidate_id": candidate_one_id,
            },
        )
        assert scoped_retrieval.status_code == 200
        scoped_retrieval_json = scoped_retrieval.json()
        assert scoped_retrieval_json["recruiter_job_id"] == job_one_id
        assert scoped_retrieval_json["recruiter_candidate_id"] == candidate_one_id
        assert scoped_retrieval_json["result_count"] >= 1
        assert all(item["recruiter_job_id"] == job_one_id for item in scoped_retrieval_json["evidence"])
        assert all(item["recruiter_candidate_id"] in {None, candidate_one_id} for item in scoped_retrieval_json["evidence"])
        assert any(item["document_type"] == "job_description" for item in scoped_retrieval_json["evidence"])
        assert any(item["document_type"] == "recruiter_candidate_cv" for item in scoped_retrieval_json["evidence"])

        recruiter_fit_summary = client.post(
            "/rag/recruiter/fit-summary",
            headers=recruiter_headers,
            json={
                "query": "Summarize the fit for the retrieval role.",
                "document_types": ["job_description", "recruiter_candidate_cv"],
                "top_k": 5,
                "score_threshold": 0.0,
                "recruiter_job_id": job_one_id,
                "recruiter_candidate_id": candidate_one_id,
            },
        )
        assert recruiter_fit_summary.status_code == 200
        recruiter_fit_summary_json = recruiter_fit_summary.json()
        assert recruiter_fit_summary_json["recruiter_job_id"] == job_one_id
        assert recruiter_fit_summary_json["recruiter_candidate_id"] == candidate_one_id
        assert recruiter_fit_summary_json["evidence_count"] >= 1

        save_scoped_report = client.post(
            "/reports",
            headers=recruiter_headers,
            json={
                "report_type": "recruiter_fit_summary",
                "query": "Summarize the fit for the retrieval role.",
                "recruiter_candidate_id": candidate_one_id,
                "payload": recruiter_fit_summary_json,
            },
        )
        assert save_scoped_report.status_code == 201
        save_scoped_report_json = save_scoped_report.json()
        assert save_scoped_report_json["recruiter_job_id"] == job_one_id
        assert save_scoped_report_json["recruiter_candidate_id"] == candidate_one_id

        recruiter_history_by_job = client.get(
            "/reports",
            headers=recruiter_headers,
            params={"recruiter_job_id": job_one_id},
        )
        assert recruiter_history_by_job.status_code == 200
        recruiter_history_by_job_json = recruiter_history_by_job.json()
        assert recruiter_history_by_job_json["total"] == 1
        assert recruiter_history_by_job_json["items"][0]["recruiter_job_id"] == job_one_id

        recruiter_history_by_candidate = client.get(
            "/reports",
            headers=recruiter_headers,
            params={"recruiter_candidate_id": candidate_one_id},
        )
        assert recruiter_history_by_candidate.status_code == 200
        recruiter_history_by_candidate_json = recruiter_history_by_candidate.json()
        assert recruiter_history_by_candidate_json["total"] == 1
        assert recruiter_history_by_candidate_json["items"][0]["recruiter_candidate_id"] == candidate_one_id

        recruiter_history_wrong_scope = client.get(
            "/reports",
            headers=recruiter_headers,
            params={"recruiter_job_id": job_two_id},
        )
        assert recruiter_history_wrong_scope.status_code == 200
        assert recruiter_history_wrong_scope.json()["total"] == 0


def test_recruiter_dashboard_and_review_endpoints_return_summary_shapes(tmp_path: Path, monkeypatch) -> None:
    with build_test_client(tmp_path, monkeypatch) as (client, _session_factory):
        recruiter_token = register_and_login(client, email="recruiter-dashboard@example.com", role="recruiter")
        recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

        job_response = client.post(
            "/recruiter/jobs",
            headers=recruiter_headers,
            json={
                "title": "Platform Retrieval Engineer",
                "description": "Own retrieval APIs and interview signal quality.",
                "location": "Remote",
                "skills_required": ["FastAPI", "SQLAlchemy", "Chroma"],
            },
        )
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]

        candidate_response = client.post(
            f"/recruiter/jobs/{job_id}/candidates",
            headers=recruiter_headers,
            json={
                "full_name": "Taylor Reviewer",
                "current_title": "Senior Backend Engineer",
                "notes": "Strong retrieval signal. Verify production scale.",
            },
        )
        assert candidate_response.status_code == 201
        candidate_id = candidate_response.json()["id"]

        job_document_upload = client.post(
            f"/recruiter/jobs/{job_id}/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "job.txt",
                    BytesIO(b"# Requirements\nNeed retrieval systems, evidence-backed screening, and API ownership.\n"),
                    "text/plain",
                )
            },
            data={"document_type": "job_description"},
        )
        assert job_document_upload.status_code == 201

        candidate_document_upload = client.post(
            f"/recruiter/jobs/{job_id}/candidates/{candidate_id}/documents/upload",
            headers=recruiter_headers,
            files={
                "file": (
                    "candidate.pdf",
                    BytesIO(
                        create_pdf_bytes(
                            title="Candidate",
                            body="Built retrieval systems and grounded interview tooling with FastAPI.",
                        )
                    ),
                    "application/pdf",
                )
            },
            data={"document_type": "recruiter_candidate_cv"},
        )
        assert candidate_document_upload.status_code == 201

        for document_id in [job_document_upload.json()["id"], candidate_document_upload.json()["id"]]:
            assert client.post(f"/documents/{document_id}/parse", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/chunk", headers=recruiter_headers).status_code == 200
            assert client.post(f"/documents/{document_id}/reindex", headers=recruiter_headers).status_code == 200

        fit_summary_response = client.post(
            "/rag/recruiter/fit-summary",
            headers=recruiter_headers,
            json={
                "query": "Summarize fit for the retrieval platform role.",
                "document_types": ["job_description", "recruiter_candidate_cv"],
                "top_k": 5,
                "score_threshold": 0.0,
                "recruiter_job_id": job_id,
                "recruiter_candidate_id": candidate_id,
            },
        )
        assert fit_summary_response.status_code == 200

        save_report_response = client.post(
            "/reports",
            headers=recruiter_headers,
            json={
                "report_type": "recruiter_fit_summary",
                "query": "Summarize fit for the retrieval platform role.",
                "recruiter_job_id": job_id,
                "recruiter_candidate_id": candidate_id,
                "payload": fit_summary_response.json(),
            },
        )
        assert save_report_response.status_code == 201

        dashboard_response = client.get("/recruiter/dashboard", headers=recruiter_headers)
        assert dashboard_response.status_code == 200
        dashboard_json = dashboard_response.json()
        assert dashboard_json["jobs_count"] == 1
        assert dashboard_json["candidate_count"] == 1
        assert dashboard_json["candidate_document_count"] == 1
        assert dashboard_json["report_count"] == 1
        assert dashboard_json["recent_reports"][0]["recruiter_job_id"] == job_id
        assert candidate_response.json()["full_name"] in dashboard_json["recent_candidate_names"]

        job_review_response = client.get(f"/recruiter/jobs/{job_id}/review", headers=recruiter_headers)
        assert job_review_response.status_code == 200
        job_review_json = job_review_response.json()
        assert job_review_json["job_document_count"] == 1
        assert job_review_json["candidate_count"] == 1
        assert job_review_json["report_count"] == 1
        assert job_review_json["latest_report_type"] == "recruiter_fit_summary"
        assert job_review_json["candidates"][0]["report_count"] == 1
        assert job_review_json["candidates"][0]["document_count"] == 1

        candidate_review_response = client.get(
            f"/recruiter/jobs/{job_id}/candidates/{candidate_id}/review",
            headers=recruiter_headers,
        )
        assert candidate_review_response.status_code == 200
        candidate_review_json = candidate_review_response.json()
        assert candidate_review_json["document_count"] == 1
        assert candidate_review_json["report_count"] == 1
        assert candidate_review_json["latest_report_type"] == "recruiter_fit_summary"
        assert candidate_review_json["document_types"] == ["recruiter_candidate_cv"]
        assert candidate_review_json["report_history"][0]["recruiter_candidate_id"] == candidate_id

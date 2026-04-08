# REVIEW.md

## Review date
2026-04-08

## Scope reviewed
- Backend compile health
- Alembic migration health
- Current FastAPI API flow
- Document processing pipeline
- Indexing failure handling

## Commands run
```bash
cd backend
uv sync --group dev
PYTHONPYCACHEPREFIX=/tmp/pythoncache python3 -m compileall app alembic tests
UV_CACHE_DIR=/tmp/uv-cache uv run alembic upgrade head
UV_CACHE_DIR=/tmp/uv-cache uv run pytest -q
```

## Test result
- `compileall`: passed
- `alembic upgrade head`: passed
- `pytest`: passed
- Result summary: `2 passed, 5 warnings`

## What was tested
1. System endpoints:
   - `/health`
   - `/ready`
2. Auth flow:
   - register
   - login
   - current user
3. Candidate flow:
   - create profile
   - dashboard summary
4. Document pipeline:
   - upload
   - parse
   - chunk
   - reindex
5. Persistence checks:
   - document parsing status
   - document indexing status
   - chunk `embedding_ref`
   - Chroma vector count for the indexed document
6. Failure-path handling:
   - simulated embedding provider failure returns `409`
   - failed indexing state persists on the document
   - stale chunk vector refs remain cleared on failure

## Improvement made during review
- Added repeatable backend integration tests in `backend/tests/test_backend_pipeline.py`
- Added `pytest` to backend dev dependencies

This closes the biggest testing gap in the current project: previously the repo had smoke checks but no committed automated backend test coverage.

## Findings
- No blocking functional errors were left in the tested backend flow after the review work.
- One initial gap was the absence of automated tests. That has now been addressed with an integration test file covering the current API pipeline.

## Warnings observed
- PyMuPDF emitted deprecation warnings from generated SWIG types during pytest.
- These warnings come from the dependency layer, not from the application code paths added here.

## Remaining risks
- No frontend test surface exists yet.
- No retrieval tests exist yet.
- No migration rollback test exists yet.
- No recruiter workflow tests exist yet.
- The OpenAI credential-missing branch is still best covered by a dedicated environment-level smoke test once real provider switching is exercised outside the deterministic local fallback.

## Recommended next testing additions
1. Add retrieval integration tests once the retriever service exists.
2. Add Alembic rollback smoke coverage.
3. Add recruiter-role API tests when recruiter endpoints are implemented.
4. Add a provider-selection test that runs in a fully isolated environment for the OpenAI branch.

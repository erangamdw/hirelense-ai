# hirelense-ai

AI-powered interview and hiring intelligence platform.

## Backend setup

The current implementation is the backend foundation. Python dependency management now uses `uv`.

Install `uv` first if it is not already available, then run:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

If you want to use PostgreSQL locally, create `backend/.env` from `.env.example` and point `DATABASE_URL` at your running database. If you only want the current smoke test, you can skip `.env` and use the default SQLite URL.

Smoke-test the current API:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ready
```

When migrations are needed, run them with:

```bash
uv run alembic upgrade head
```

# hirelense-ai

AI-powered interview and hiring intelligence platform.

## Local setup

The project now has a FastAPI backend and a Next.js frontend foundation.

### Backend

Python dependency management uses `uv`. Install `uv` first if it is not already available, then run:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

If you want to use PostgreSQL locally, create `backend/.env` from `.env.example` and point `DATABASE_URL` at your running database. If you only want the current smoke test, you can skip `.env` and use the default SQLite URL.

The backend now accepts browser requests from `http://127.0.0.1:3000` and `http://localhost:3000` by default via `ALLOWED_ORIGINS`.

### Frontend

Install frontend dependencies and run the app:

```bash
cd frontend
npm install
npm run dev
```

Set `frontend/.env` from `frontend/.env.example` if you need a non-default backend URL.

The default frontend API target is:

```text
http://127.0.0.1:8000
```

Key browser routes:
- `/`
- `/login`
- `/register`
- `/candidate`
- `/recruiter`

Smoke-test the current API:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ready
```

When migrations are needed, run them with:

```bash
uv run alembic upgrade head
```

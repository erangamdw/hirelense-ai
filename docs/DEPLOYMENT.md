# DEPLOYMENT.md

## Goal
This document captures the production-facing decisions for a first hosted version of HireLens AI.

The repo is already valid as a local evaluator submission. This file covers the next step up: a minimal, realistic production deployment shape.

## Recommended deployment shape
- frontend host: Vercel or another Next.js-friendly host
- backend host: Render, Fly.io, Railway, or another FastAPI-friendly host
- relational database: PostgreSQL
- uploads and vector persistence for v1: persistent disk volumes

## Backend production environment
Recommended backend environment values:

```env
APP_ENV=production
DEBUG=false
LOG_LEVEL=INFO
ENABLE_DOCS=false
ALLOWED_ORIGINS=https://your-frontend-domain.example
DATABASE_URL=postgresql+psycopg://user:password@host:5432/hirelense_ai
JWT_SECRET_KEY=replace-with-a-strong-secret
UPLOAD_DIR=/data/uploads
VECTOR_DB_PATH=/data/chroma
```

Production guardrails now implemented in the backend:
- app startup fails if production is using the default JWT secret
- app startup fails if production leaves docs enabled
- app startup fails if production still uses SQLite
- app startup fails if required OpenAI settings are missing while OpenAI providers are selected
- readiness now checks both database and vector-store connectivity

## Frontend production environment
Frontend production API configuration:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.example
```

The frontend already reads `NEXT_PUBLIC_API_BASE_URL`, so production configuration is an environment-only change.

## CORS production config
Set `ALLOWED_ORIGINS` to the exact deployed frontend origins, for example:

```env
ALLOWED_ORIGINS=https://hirelense-ai.example,https://www.hirelense-ai.example
```

Do not leave local `localhost` origins in the production configuration unless you intentionally want them enabled.

## Migration strategy
Recommended first-version migration strategy:
1. provision PostgreSQL
2. set production `DATABASE_URL`
3. run `uv run alembic upgrade head`
4. start the backend
5. confirm `/health` and `/ready`
6. confirm login plus one candidate flow against the hosted stack

For future schema changes:
- commit Alembic migrations with each DB change
- apply migrations before switching traffic to the new release
- avoid manual schema drift outside Alembic

## File storage strategy
Current development strategy:
- local filesystem uploads
- local persistent Chroma path

Current production strategy for a first hosted version:
- use persistent volumes for uploads and Chroma
- keep upload and vector paths outside ephemeral container paths

Cloud-storage upgrade path:
- move uploads to an object store such as S3-compatible storage
- keep Chroma on persistent disk or replace it with a hosted vector strategy later
- retain the current service boundaries so the storage backend can be swapped without rewriting the UI flows

## Storage abstraction notes
The repo currently stores uploaded files and Chroma data by path configuration:
- `UPLOAD_DIR`
- `VECTOR_DB_PATH`

That is enough for v1, but the code should eventually be wrapped behind a storage abstraction if:
- multiple app instances need shared file access
- object storage becomes necessary
- background reindex/recovery workflows are added

## Backup notes
For a first production version, the minimum backup plan should cover:
- PostgreSQL backups or managed snapshots
- uploaded files
- Chroma persistence path if rebuild time matters

Operationally:
- PostgreSQL should be treated as the primary durable system of record
- uploaded files should be backed up because re-parsing depends on them
- Chroma can be rebuilt from stored documents plus the DB metadata, but snapshots reduce recovery time

## Minimal release checklist
- backend deployed with production env vars
- frontend deployed with production API URL
- PostgreSQL connected
- Alembic run to head
- `/health` returns `ok`
- `/ready` returns `ready`
- one candidate flow works end to end
- one recruiter flow works end to end

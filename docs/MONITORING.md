# MONITORING.md

## Basic monitoring checklist
Use this as the minimum operations checklist for a first hosted version.

## Availability
- Confirm `/health` returns `200`
- Confirm `/ready` returns `200`
- Alert on repeated readiness failures

## Application logs
- Review request logs for elevated `5xx` responses
- Review auth/login failures for unusual spikes
- Review upload, parsing, retrieval, and generation failures

## Database
- Watch database connectivity failures
- Watch migration failures during deploys
- Track backup status for PostgreSQL

## File and vector persistence
- Watch disk usage for `UPLOAD_DIR`
- Watch disk usage for `VECTOR_DB_PATH`
- Confirm persistent volume mounts exist after deploys

## Performance
- Sample request duration from backend request logs
- Watch retrieval and generation latency for noticeable regressions

## Recovery
- Confirm the team knows how to:
  - rerun Alembic migrations
  - restore PostgreSQL backups
  - rebuild Chroma from stored documents if required

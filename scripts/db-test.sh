#!/usr/bin/env bash
# Applies migration + seed + RLS tests to a SCRATCH Postgres (never a real Supabase project).
# Usage: DATABASE_URL=postgres://postgres@localhost:5432/postgres ./scripts/db-test.sh
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a scratch Postgres (it will be wiped)}"
cd "$(dirname "$0")/.."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;" 2>/dev/null
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_supabase_stub.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261002000000_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261003000000_ensure_interests.sql  # must be idempotent on top of init
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261004000000_provenance_feedback_reminders.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261005000000_reminders_skip_samples.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261006000000_explicit_table_grants.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql 2>&1 | grep -E "ok  |FAIL|ERROR|PASSED"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_v02.test.sql 2>&1 | grep -E "ok  |FAIL|ERROR|PASSED"

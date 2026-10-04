#!/usr/bin/env bash
# Applies the pending migrations IN ORDER to the live Supabase database, then runs the read-only verification.
# All of them are idempotent. Needs the Postgres connection string (Supabase → Project Settings → Database →
# Connection string → URI, "Session pooler" or direct). Pass it via env so it never appears in shell history/args:
#   read -rs SUPABASE_DB_URL && export SUPABASE_DB_URL
#   ./scripts/launch/apply-migrations.sh
set -euo pipefail
: "${SUPABASE_DB_URL:?export SUPABASE_DB_URL first (do not paste it on the command line)}"
cd "$(dirname "$0")/../.."
for f in supabase/migrations/20261003000000_ensure_interests.sql supabase/migrations/20261004000000_provenance_feedback_reminders.sql supabase/migrations/20261005000000_reminders_skip_samples.sql supabase/migrations/20261006000000_explicit_table_grants.sql; do
  echo "→ applying $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | grep -v "NOTICE" || true
  [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "✗ $f failed — stopped. Nothing after it was applied."; exit 1; }
done
echo "→ verifying"
OUT=$(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -At -F ' | ' -f supabase/launch/verify_launch_schema.sql)
echo "$OUT" | grep -E "f$|VERDICT|INFO" || true
echo "$OUT" | grep -q "ALL .* CHECKS PASSED" && echo "✓ schema verified" || { echo "✗ verification failed (see rows ending in '| f')"; exit 1; }

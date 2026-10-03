#!/usr/bin/env bash
# Configures production deadline reminders end to end WITHOUT ever printing or passing secrets on a command line:
#   1. generates CRON_SECRET (or uses one you export)           2. sets Vercel production env vars (stdin only)
#   3. stores ONLY the SHA-256 of CRON_SECRET in Supabase       4. redeploys production
#   5. calls the cron endpoint twice and checks idempotency      6. optionally sends one SMTP test mail
#
# Needs (export beforehand; read -rs keeps them out of history):
#   VERCEL_TOKEN          Vercel access token (or be logged in with `vercel login`)
#   SUPABASE_DB_URL       Supabase Postgres connection string
#   SMTP_PASS             the Gmail APP PASSWORD for the sender account
# Optional: VERCEL_SCOPE (default opportunity-os1), VERCEL_PROJECT (default opportunityos), SMTP_USER, EMAIL_FROM,
#           SITE_URL (default https://opportunityos-ochre.vercel.app), TEST_MAILBOX (readable address for an SMTP test)
set -euo pipefail
set +x
: "${SUPABASE_DB_URL:?export SUPABASE_DB_URL}"; : "${SMTP_PASS:?export SMTP_PASS}"
SCOPE="${VERCEL_SCOPE:-opportunity-os1}"; PROJECT="${VERCEL_PROJECT:-opportunityos}"
SITE_URL="${SITE_URL:-https://opportunityos-ochre.vercel.app}"
SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"; SMTP_PORT="${SMTP_PORT:-465}"
SMTP_USER="${SMTP_USER:-opportunityos.team@gmail.com}"
EMAIL_FROM="${EMAIL_FROM:-OpportunityOS <opportunityos.team@gmail.com>}"
CRON_SECRET="${CRON_SECRET:-$(openssl rand -hex 32)}"
cd "$(dirname "$0")/../.."
command -v vercel >/dev/null || { echo "install the Vercel CLI: npm i -g vercel"; exit 1; }

echo "→ linking Vercel project ($SCOPE/$PROJECT)"
vercel link --yes --project "$PROJECT" --scope "$SCOPE" >/dev/null

setenv() { printf %s "$2" | vercel env add "$1" production --force --scope "$SCOPE" >/dev/null && echo "  ✓ $1 set"; }
echo "→ setting production environment variables (values are not printed)"
setenv CRON_SECRET "$CRON_SECRET"; setenv SMTP_HOST "$SMTP_HOST"; setenv SMTP_PORT "$SMTP_PORT"
setenv SMTP_USER "$SMTP_USER"; setenv SMTP_PASS "$SMTP_PASS"; setenv EMAIL_FROM "$EMAIL_FROM"

echo "→ storing the SHA-256 of CRON_SECRET in Supabase (the secret itself never goes in SQL)"
HASH=$(printf %s "$CRON_SECRET" | sha256sum | cut -d' ' -f1)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -v h="$HASH" <<'SQL'
insert into public.cron_secret (id, secret_hash) values (1, :'h')
on conflict (id) do update set secret_hash = excluded.secret_hash;
SQL
echo "  ✓ hash stored"

echo "→ redeploying production (env changes only apply to new deployments)"
URL=$(vercel deploy --prod --yes --scope "$SCOPE" | tail -1); echo "  ✓ deployed: $URL"
sleep 8

call() { curl -sS -m 90 --config <(printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET") "$SITE_URL/api/cron/reminders"; }
echo "→ unauthenticated call must be rejected"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/api/cron/reminders"); [ "$CODE" = "401" ] && echo "  ✓ 401" || { echo "  ✗ expected 401, got $CODE"; exit 1; }
echo "→ authorized run #1"; R1=$(call); echo "  $R1"
echo "→ authorized run #2 (must claim nothing new = idempotent)"; R2=$(call); echo "  $R2"
echo "$R2" | grep -q '"claimed":0' && echo "  ✓ idempotent" || { echo "  ✗ second run claimed new reminders"; exit 1; }
echo "$R1" | grep -q '"failed":0' && echo "  ✓ no send failures" || { echo "  ✗ some sends failed — see Vercel logs for [reminders]"; exit 1; }
if [ -n "${TEST_MAILBOX:-}" ]; then
  echo "→ SMTP delivery test to \$TEST_MAILBOX"; SMTP_HOST="$SMTP_HOST" SMTP_PORT="$SMTP_PORT" SMTP_USER="$SMTP_USER" SMTP_PASS="$SMTP_PASS" EMAIL_FROM="$EMAIL_FROM" node scripts/launch/smtp-test.mjs "$TEST_MAILBOX"
fi
echo "✓ reminders configured. Vercel Cron (vercel.json) will call the endpoint daily at 13:00 UTC."

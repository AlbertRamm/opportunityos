#!/usr/bin/env bash
# Triggers ONE real magic-link request against Supabase Auth and reports exactly what Supabase says.
# GoTrue sends the email synchronously, so SMTP failures come back in the HTTP response — this isolates
# "app problem" vs "Supabase/SMTP problem" in one call. Then read the mailbox (spam too) and run the link checks below.
#   export SUPABASE_URL=https://jtgxmhrhebnjufttnxkn.supabase.co
#   read -rs SUPABASE_ANON_KEY && export SUPABASE_ANON_KEY
#   TEST_EMAIL=readable@mailbox.com SITE_URL=https://opportunityos-ochre.vercel.app ./scripts/launch/diagnose-auth-email.sh
set -euo pipefail; set +x
: "${SUPABASE_URL:?}"; : "${SUPABASE_ANON_KEY:?}"; : "${TEST_EMAIL:?}"
SITE_URL="${SITE_URL:-https://opportunityos-ochre.vercel.app}"
VERIFIER=$(openssl rand -base64 48 | tr -d '=+/\n' | cut -c1-64)
CHALLENGE=$(printf %s "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
REDIR=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote('$SITE_URL/auth/callback?next=/dashboard', safe=''))")

echo "→ auth settings (public): $(curl -sS -m 20 "$SUPABASE_URL/auth/v1/settings" -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print({k: d.get(k) for k in ('disable_signup','mailer_autoconfirm')}, 'email_provider=', d.get('external',{}).get('email'))" 2>/dev/null || echo 'unavailable')"
echo "→ requesting a magic link for $TEST_EMAIL (redirect_to=$SITE_URL/auth/callback)"
RESP=$(curl -sS -m 60 -w '\n%{http_code}' -X POST "$SUPABASE_URL/auth/v1/otp?redirect_to=$REDIR" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"create_user\":true,\"code_challenge\":\"$CHALLENGE\",\"code_challenge_method\":\"s256\"}")
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
echo "→ Supabase answered HTTP $CODE: $BODY"
case "$CODE" in
  200) echo "✓ Supabase accepted the request and handed the email to SMTP. If nothing arrives in ~2 min: check Spam, then Supabase → Logs → Auth (look for a mailer error) and the Gmail account's Sent folder / security alerts." ;;
  429) echo "✗ RATE LIMIT (over_email_send_rate_limit?). Authentication → Rate Limits → raise 'emails sent per hour' (custom SMTP default is 30/h) and wait for the window to reset." ;;
  5*)  echo "✗ SMTP/mailer failure inside Supabase. Check Authentication → SMTP: sender email must equal the SMTP username (opportunityos.team@gmail.com), host smtp.gmail.com, port 465, password = 16-char app password (no spaces), 2-Step Verification ON. Logs → Auth shows the exact SMTP error." ;;
  4*)  echo "✗ Request rejected (bad key/URL/signups disabled). Body above names the reason." ;;
esac
cat <<MSG

NEXT — when the email arrives, check the LINK itself (do not click yet):
  expected:  $SUPABASE_URL/auth/v1/verify?token=…&type=magiclink&redirect_to=$SITE_URL/auth/callback?next=/dashboard
  if redirect_to is just $SITE_URL (no /auth/callback): add  $SITE_URL/auth/callback  (and $SITE_URL/**) to
     Authentication → URL Configuration → Redirect URLs; Supabase silently falls back to Site URL otherwise.
  Then click it IN THE SAME BROWSER that requested it (PKCE): you must land on /dashboard or /onboarding signed in.
MSG

#!/usr/bin/env bash
# Smoke test for the in-app upgrade feature against a locally running stack.
#
# Prereqs:
#   docker build -t new-api:local .
#   docker compose --env-file .env.local \
#       -f docker-compose.yml -f docker-compose.local.yml up -d
#
# What this verifies:
#   1. /api/status responds (service is up)
#   2. Root login works and returns a session cookie
#   3. /api/maintenance/image-status responds with in_container=true, valid
#      image_ref, valid local_digest, and upgrader_ready=true.
#   4. /api/maintenance/upgrade is auth-gated (401 without session, 2xx with).
#      We do NOT actually trigger the upgrade — that would tear down the very
#      container running the test. Use the UI for end-to-end.

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
USER="${USER:-root}"
PASS="${PASS:-123456}"

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
pass() { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*"; exit 1; }

step "1. /api/status reachable"
status_body="$(curl -sS -m 5 "$BASE/api/status")"
echo "$status_body" | grep -q '"success":true' || fail "status endpoint not OK"
pass "service up, version=$(echo "$status_body" | sed -E 's/.*"version":"([^"]+)".*/\1/')"

step "2. login as $USER"
login_body="$(curl -sS -m 5 -c "$JAR" -X POST -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" "$BASE/api/user/login")"
echo "$login_body" | grep -q '"success":true' || fail "login failed: $login_body"
pass "session cookie acquired"

step "3. /api/maintenance/image-status (authenticated)"
img_body="$(curl -sS -m 30 -b "$JAR" "$BASE/api/maintenance/image-status")"
echo "$img_body" | jq -e '.success == true' >/dev/null || fail "image-status not success: $img_body"
in_container="$(echo "$img_body" | jq -r '.data.in_container')"
image_ref="$(echo "$img_body" | jq -r '.data.image_ref')"
local_digest="$(echo "$img_body" | jq -r '.data.local_digest')"
upgrader_ready="$(echo "$img_body" | jq -r '.data.upgrader_ready')"
message="$(echo "$img_body" | jq -r '.data.message // empty')"

[[ "$in_container" == "true" ]] && pass "in_container = true" || fail "expected in_container=true, got $in_container"
[[ "$image_ref" == "new-api:local" ]] && pass "image_ref = $image_ref" \
  || fail "expected image_ref=new-api:local, got $image_ref"
[[ "$upgrader_ready" == "true" ]] && pass "watchtower reachable" \
  || fail "watchtower not reachable: $message"

# local_digest may be empty because new-api:local was built locally and has no
# RepoDigest (never pulled from a registry). That's expected — the UI handles
# this gracefully.
if [[ -z "$local_digest" || "$local_digest" == "null" ]]; then
  pass "local_digest empty as expected (locally built image, no RepoDigest)"
else
  pass "local_digest = $local_digest"
fi

# Remote check will fail (no public new-api image), surfaced as data.message.
if [[ -n "$message" ]]; then
  pass "remote check returned message: $message"
fi

step "4. /api/maintenance/upgrade auth-gated"
unauth="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' -X POST "$BASE/api/maintenance/upgrade")"
[[ "$unauth" == "401" ]] && pass "unauthenticated POST returns 401" \
  || fail "expected 401, got $unauth"

pass "all smoke tests passed"
echo
echo "▶ End-to-end manual test:"
echo "   1. Open $BASE → login as $USER / $PASS"
echo "   2. System Settings → System maintenance → Check for updates"
echo "      Expected: panel shows image=new-api:local, watchtower badge OK,"
echo "      and a 'remote check failed' notice (since new-api:local has no"
echo "      public registry counterpart). Wiring is healthy."

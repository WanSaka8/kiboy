#!/usr/bin/env bash
# Smoke test aplikasi Keluh Kesah setelah semua container berjalan.
# Dipakai oleh GitHub Actions (job CI dan job Deploy), bisa juga dijalankan manual:
#   bash scripts/smoke-test.sh http://localhost:8080
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
DEMO_USER="${DEMO_USER:-demo}"
DEMO_PASS="${DEMO_PASS:-demo1234}"
MAX_TRY="${MAX_TRY:-30}"

ok()   { echo "  [OK]    $1"; }
fail() { echo "  [GAGAL] $1" >&2; exit 1; }

echo "Smoke test ke $BASE_URL"

# 1. API dan database siap (Nginx -> backend -> MySQL)
health=""
for i in $(seq 1 "$MAX_TRY"); do
  health=$(curl -s "$BASE_URL/api/health" || true)
  if echo "$health" | grep -q '"db":"up"'; then break; fi
  echo "  menunggu API siap ($i/$MAX_TRY)..."
  sleep 2
done
echo "$health" | grep -q '"db":"up"' || fail "GET /api/health tidak menjawab db:up (respons: ${health:-kosong})"
ok "GET /api/health -> $health"

# 2. Frontend (Nginx) menyajikan index.html
page=$(curl -s "$BASE_URL/")
echo "$page" | grep -q "Keluh Kesah" || fail "Halaman utama tidak memuat teks 'Keluh Kesah'"
ok "GET / -> index.html tersaji"

# 3. Endpoint terlindungi menolak request tanpa token
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/notes")
[ "$code" = "401" ] || fail "GET /api/notes tanpa token harus 401, didapat $code"
ok "GET /api/notes tanpa token -> 401"

# 4. Login akun demo menghasilkan token JWT
resp=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"username\":\"$DEMO_USER\",\"password\":\"$DEMO_PASS\"}" \
  "$BASE_URL/api/auth/login")
token=$(echo "$resp" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$token" ] || fail "POST /api/auth/login gagal (respons: $resp)"
ok "POST /api/auth/login -> token diterima"

# 5. Identitas dari token benar
me=$(curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/auth/me")
echo "$me" | grep -q "\"username\":\"$DEMO_USER\"" || fail "GET /api/auth/me salah (respons: $me)"
ok "GET /api/auth/me -> $me"

# 6. Data cerita terbaca dari MySQL
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$BASE_URL/api/notes")
[ "$code" = "200" ] || fail "GET /api/notes dengan token harus 200, didapat $code"
notes=$(curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/notes")
case "$notes" in \[*) ;; *) fail "GET /api/notes tidak mengembalikan daftar JSON" ;; esac
ok "GET /api/notes dengan token -> 200, daftar cerita terbaca"

echo "Semua smoke test lulus."

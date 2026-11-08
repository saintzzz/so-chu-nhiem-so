#!/usr/bin/env bash
# Apply toan bo supabase/migrations vao DB self-host (dung thu tu ten file).
# Chay tu repo root: bash deploy/vn-selfhost/scripts/migrate.sh
set -euo pipefail
DB_CONTAINER="${DB_CONTAINER:-vn-db}"
for f in supabase/migrations/*.sql; do
  echo "== $f"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f"
done
echo "ALL_MIGRATIONS_APPLIED"

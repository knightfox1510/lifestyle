#!/usr/bin/env bash
# Applies the Supabase migrations to a throwaway local PostgreSQL cluster (with
# stub auth/storage schemas) and runs the RLS tests. Needs PostgreSQL 15+
# server binaries on PATH or in PG_BIN.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PG_BIN:$PATH"

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$WORK"
  RUN_AS=(sudo -u postgres)
  command -v sudo >/dev/null || RUN_AS=(su postgres -s /bin/bash -c)
fi

run() {
  if [ "${RUN_AS[0]:-}" = "su" ]; then "${RUN_AS[@]}" "$*"; else "${RUN_AS[@]}" "$@"; fi
}

cleanup() { run "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

run "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
run "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/stubs.sql"
if [ "${USE_ALL_IN_ONE:-0}" = "1" ]; then
  echo "applying supabase/setup/all-in-one.sql"
  "${PSQL[@]}" -f "$ROOT/supabase/setup/all-in-one.sql"
else
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "applying $(basename "$f")"
    "${PSQL[@]}" -f "$f"
  done
fi
for t in "$ROOT"/supabase/tests/*.test.sql; do
  echo "running $(basename "$t")"
  "${PSQL[@]}" -f "$t"
done

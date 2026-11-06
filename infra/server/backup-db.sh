#!/usr/bin/env bash
# Consistent online copy of the SQLite DB -> s3://$YARD_BUCKET/db-backups/
set -euo pipefail
DB=/var/lib/yard/inventario.db
[ -f "$DB" ] || { echo "no DB yet, nothing to back up"; exit 0; }
TS=$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
sqlite3 "$DB" ".backup '$TMP/inventario.db'"
aws s3 cp --only-show-errors "$TMP/inventario.db" "s3://${YARD_BUCKET}/db-backups/inventario-$TS.db"
echo "backup ok: db-backups/inventario-$TS.db"

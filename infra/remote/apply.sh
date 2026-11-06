#!/usr/bin/env bash
# Runs ON THE INSTANCE (as root, via SSM) for every deploy.
# Usage: apply.sh <extracted-release-dir>      env: RESEED_DB=1 to overwrite the DB
set -euo pipefail

STAGE=${1:?usage: apply.sh <release-dir>}
TS=$(date -u +%Y%m%dT%H%M%SZ)
REL=/opt/yard/releases/$TS
DATA=/var/lib/yard

[ -f "$DATA/.bootstrapped" ] || { echo "bootstrap has not finished (see /var/log/yard-bootstrap.log)"; exit 1; }

mv "$STAGE" "$REL"
chmod -R go+rX "$REL"

# ── Data: seed once, never clobber what the PWA has written ─────────────────
if [ ! -f "$DATA/inventario.db" ] || [ "${RESEED_DB:-0}" = "1" ]; then
  if [ -f "$DATA/inventario.db" ]; then
    cp "$DATA/inventario.db" "$DATA/backups/inventario-before-reseed-$TS.db"
    echo "existing DB saved to $DATA/backups/"
  fi
  cp "$REL/seed/inventario.db" "$DATA/inventario.db"
  echo "DB seeded"
else
  echo "DB kept as is"
fi
cp -rn "$REL/seed/salida/." "$DATA/salida/"      # additive, no overwrite
chown -R yard:yard "$DATA"
ln -s "$DATA/inventario.db" "$REL/inventario.db"
ln -s "$DATA/salida" "$REL/salida"

# ── Python deps ──────────────────────────────────────────────────────────────
/opt/yard/venv/bin/pip install --quiet --disable-pip-version-check -r "$REL/requirements.server.txt"

# ── Origin secret: nginx only accepts requests carrying CloudFront's header ──
set -a; . /etc/yard/yard.env; set +a
ORIGIN_SECRET="$(aws secretsmanager get-secret-value --secret-id "$YARD_ORIGIN_SECRET_ID" \
  --query SecretString --output text)"
[ -n "$ORIGIN_SECRET" ] || { echo "empty origin secret" >&2; exit 1; }
( umask 027
  printf 'map $http_x_origin_verify $yard_origin_ok {\n    default 0;\n    "%s" 1;\n}\n' "$ORIGIN_SECRET" \
    > /etc/nginx/yard-origin.conf )
chown root:nginx /etc/nginx/yard-origin.conf
chmod 640 /etc/nginx/yard-origin.conf

# ── System config (nginx, systemd, backups) ──────────────────────────────────
install -m 644 "$REL/server/nginx.conf"          /etc/nginx/nginx.conf
install -m 644 "$REL/server/yard.service"        /etc/systemd/system/yard.service
install -m 644 "$REL/server/yard-backup.service" /etc/systemd/system/yard-backup.service
install -m 644 "$REL/server/yard-backup.timer"   /etc/systemd/system/yard-backup.timer
install -m 755 "$REL/server/backup-db.sh"        /usr/local/bin/yard-backup-db
nginx -t
systemctl daemon-reload
systemctl enable yard yard-backup.timer >/dev/null 2>&1
systemctl start yard-backup.timer

# ── Switch release, restart, verify, roll back on failure ───────────────────
PREV=$(readlink -f /opt/yard/current 2>/dev/null || true)
ln -sfn "$REL" /opt/yard/current
systemctl restart yard
systemctl enable --now nginx >/dev/null 2>&1
systemctl reload nginx

healthy() {
  for _ in $(seq 1 20); do
    if curl -fsS -o /dev/null http://127.0.0.1:8766/api/patio \
       && curl -fsS -o /dev/null -H "X-Origin-Verify: $ORIGIN_SECRET" http://127.0.0.1/ui/ \
       && curl -fsS -o /dev/null -H "X-Origin-Verify: $ORIGIN_SECRET" http://127.0.0.1/pwa/ \
       && [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ui/)" = "403" ]; then return 0; fi
    sleep 1
  done
  return 1
}

if healthy; then
  echo "release $TS is healthy"
else
  echo "HEALTH CHECK FAILED for $TS" >&2
  journalctl -u yard -n 30 --no-pager >&2 || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" /opt/yard/current
    systemctl restart yard
    echo "rolled back to $PREV" >&2
  fi
  exit 1
fi

# Keep the last 3 releases.
ls -1dt /opt/yard/releases/* | tail -n +4 | xargs -r rm -rf

#!/usr/bin/env bash
# Build the release tarball from an explicit allowlist. Prints its path.
# Everything not listed here (.git, modelos/, output/, fotos/, tests, *.pem, ...) stays out.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$INFRA/dist/yard-$TS.tar.gz"
S="$(mktemp -d)"
trap 'rm -rf "$S"' EXIT
mkdir -p "$INFRA/dist"

cd "$ROOT"
# App code
cp interfaz.py compartir_ui.py inventario_ui.py procesar_vuelo.py interfaz.html plantilla_mapa.html "$S/"
cp -R web "$S/web" && rm -rf "$S/web/data"           # data/patio.json is no longer used
mkdir -p "$S/vendor" && cp -R vendor/leaflet "$S/vendor/leaflet"

# PWA: static files only (no certs, local dev servers, screenshots, docs)
mkdir "$S/pwa"   # lowercase: nginx serves /pwa/ from this dir (Linux is case-sensitive)
(cd PWA && tar --exclude='*.pem' --exclude='*.png' --exclude='serve_*.py' \
    --exclude='*.md' --exclude='_openssl_min.cnf' -cf - .) | tar -xf - -C "$S/pwa"

# Server-side files shipped with every release
cp infra/requirements.server.txt "$S/"
cp -R infra/server "$S/server"
cp -R infra/remote "$S/remote"

# Seed data: used only if the instance has no DB yet (or --reseed-db)
mkdir -p "$S/seed/salida"
cp inventario.db "$S/seed/inventario.db"
for d in salida/vuelo_*/recortes; do
  [ -d "$d" ] || continue
  mkdir -p "$S/seed/$(dirname "$d")" && cp -R "$d" "$S/seed/$d"
done

for f in compartir_ui.py web/index.html pwa/index.html pwa/sw.js seed/inventario.db remote/apply.sh; do
  [ -e "$S/$f" ] || { echo "bundle is missing $f" >&2; exit 1; }
done

tar -czf "$OUT" -C "$S" .
echo "bundle: $OUT ($(du -h "$OUT" | cut -f1), $(tar -tzf "$OUT" | wc -l) entries)" >&2
echo "$OUT"

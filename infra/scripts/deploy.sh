#!/usr/bin/env bash
# Bundle -> S3 -> SSM -> apply on the instance. No SSH.
#   infra/scripts/deploy.sh               deploy code (DB untouched once it exists)
#   infra/scripts/deploy.sh --reseed-db   ALSO overwrite the server DB with the repo's inventario.db
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

RESEED=0
for a in "$@"; do
  case "$a" in
    --reseed-db) RESEED=1 ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

load_outputs
BUNDLE="$("$HERE/bundle.sh")"
KEY="releases/$(basename "$BUNDLE")"

echo "Uploading to s3://$BUCKET/$KEY"
aws s3 cp --only-show-errors "$BUNDLE" "s3://$BUCKET/$KEY"

wait_ssm
echo "Applying on $INSTANCE_ID (reseed-db=$RESEED) ..."
ssm_run "
set -euo pipefail
export AWS_DEFAULT_REGION=$AWS_REGION
cloud-init status --wait >/dev/null 2>&1 || true
S=\$(mktemp -d /opt/yard/stage.XXXXXX)
aws s3 cp --only-show-errors s3://$BUCKET/$KEY /tmp/release.tgz
tar -xzf /tmp/release.tgz -C \"\$S\"
rm -f /tmp/release.tgz
RESEED_DB=$RESEED bash \"\$S/remote/apply.sh\" \"\$S\"
" "yard deploy $KEY"

echo
echo "Deployed. Operator UI: $URL/ui/    PWA: $URL/pwa/"

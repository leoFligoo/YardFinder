#!/usr/bin/env bash
# Last lines of the app, nginx and bootstrap logs:  infra/scripts/logs.sh [lines]
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
load_outputs
N="${1:-80}"
ssm_run "journalctl -u yard -u nginx -n $N --no-pager; echo '--- bootstrap ---'; tail -n 20 /var/log/yard-bootstrap.log" "yard logs"

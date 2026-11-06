#!/usr/bin/env bash
# Interactive shell on the instance via SSM (needs the session-manager-plugin locally).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
load_outputs
exec aws ssm start-session --target "$INSTANCE_ID"

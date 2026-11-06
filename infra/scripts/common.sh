#!/usr/bin/env bash
# Shared helpers. Source this; don't run it.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-fligoo-hackathon-admin}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
STACK="${STACK_NAME:-YardFinder}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$INFRA/.." && pwd)"

stack_output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

load_outputs() {
  INSTANCE_ID="$(stack_output InstanceId)"
  BUCKET="$(stack_output BucketName)"
  URL="$(stack_output Url)"
  if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
    echo "Stack $STACK has no outputs. Run: cd infra && cdk deploy" >&2
    exit 1
  fi
}

# Wait until the SSM agent on the instance is reachable (a few minutes after first boot).
wait_ssm() {
  echo "Waiting for SSM agent on $INSTANCE_ID ..."
  for _ in $(seq 1 60); do
    ping="$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
      --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
    [ "$ping" = "Online" ] && return 0
    sleep 10
  done
  echo "Instance never came online in SSM." >&2
  return 1
}

# ssm_run "<bash script>" "<comment>"  — runs as root on the instance, prints output.
ssm_run() {
  local b64 params cid st
  b64="$(printf '%s' "$1" | base64 -w0)"
  params="{\"commands\":[\"echo $b64 | base64 -d | bash\"]}"
  cid="$(aws ssm send-command --instance-ids "$INSTANCE_ID" \
    --document-name AWS-RunShellScript --comment "${2:-yard}" \
    --timeout-seconds 900 --parameters "$params" \
    --query Command.CommandId --output text)"
  while :; do
    st="$(aws ssm get-command-invocation --command-id "$cid" --instance-id "$INSTANCE_ID" \
      --query Status --output text 2>/dev/null || echo Pending)"
    case "$st" in Pending|InProgress|Delayed) sleep 3 ;; *) break ;; esac
  done
  aws ssm get-command-invocation --command-id "$cid" --instance-id "$INSTANCE_ID" \
    --query StandardOutputContent --output text
  aws ssm get-command-invocation --command-id "$cid" --instance-id "$INSTANCE_ID" \
    --query StandardErrorContent --output text >&2
  [ "$st" = "Success" ] || { echo "SSM command finished with status: $st" >&2; return 1; }
}

---
name: deploy-infra
description: Deploy Yard Finder to AWS. Verifies the repo is on an up-to-date, clean main, runs `cdk deploy` only if the infrastructure changed, then ships the app (operator UI + PWA) with infra/scripts/deploy.sh and verifies the live URLs. Use when the user asks to deploy, release, ship, publish, or update the app or infra on AWS.
---

# Deploy Yard Finder

Stack `YardFinder` in account 996837001881, us-east-1, profile `fligoo-hackathon-admin`.
Architecture and details: `infra/README.md`. Run everything from the repo root unless noted.

Do the steps in order and **stop at the first failure**. Report what failed; don't work around it.

## 1. Preconditions (stop if any fails)

```bash
git branch --show-current                 # must be: main
git fetch origin
git status --porcelain                    # must be empty (ignore untracked files unrelated to infra/app, but mention them)
git rev-parse HEAD origin/main            # the two hashes must match
```

- Not on `main`: stop and tell the user. Do **not** switch branches or merge on their behalf.
- Local `main` behind `origin/main`: stop and ask before running `git pull`.
- Local `main` ahead of `origin/main` (unpushed commits): stop. Deploying code that isn't on `main` defeats the check.
- Uncommitted tracked changes: stop and list them.

AWS access:

```bash
export AWS_PROFILE=fligoo-hackathon-admin JSII_SILENCE_WARNING_UNTESTED_NODE_VERSION=1
aws sts get-caller-identity
```

If it fails (expired SSO), ask the user to run `! aws sso login --profile fligoo-hackathon-admin` and retry.
Also confirm `cdk --version` works; if missing, tell the user to `npm install -g aws-cdk`.

## 2. Infrastructure: deploy only if it changed

```bash
cd infra
[ -d node_modules ] || npm install
cdk diff --fail            # exit 0 = no changes, exit 1 = changes
```

- **Exit 0:** say "infra unchanged, skipping cdk deploy" and go to step 3.
- **Exit 1:** show the user a short summary of the diff (resources added/changed/removed, IAM and security-group changes).
  - If the diff **replaces or removes** the instance, the data volume, the bucket, or the CloudFront distribution, or widens
    security group / IAM access: stop and get explicit confirmation before deploying.
  - Otherwise run `cdk deploy --require-approval never`. It can take ~6 minutes when CloudFront changes
    (use a long timeout, e.g. 600000 ms).

## 3. App: ship the code

```bash
cd ..   # repo root
./infra/scripts/deploy.sh
```

It bundles an allowlist of files, uploads to S3, runs `remote/apply.sh` on the instance through SSM, health-checks
`/api/patio`, `/ui/` and `/pwa/`, and rolls back automatically on failure.

- **Never pass `--reseed-db`** unless the user explicitly asks for it: it overwrites the server's `inventario.db`
  (the PWA will write to it). The previous DB is saved on the instance under `/var/lib/yard/backups/` first.
- If the script reports `HEALTH CHECK FAILED`, run `./infra/scripts/logs.sh` and report the relevant lines.

## 4. Verify from outside

```bash
URL=$(aws cloudformation describe-stacks --stack-name YardFinder \
  --query "Stacks[0].Outputs[?OutputKey=='Url'].OutputValue" --output text)
for p in /ui/ /pwa/ /api/patio; do printf "%-12s %s\n" $p "$(curl -s -o /dev/null -w '%{http_code}' $URL$p)"; done
curl -s -o /dev/null -w '/api/config %{http_code} (expect 404)\n' $URL/api/config
```

All three should be 200 and `/api/config` 404. Finish with a short report: whether infra was deployed or skipped,
the release id, the commit that was deployed (`git rev-parse --short HEAD`), and the URLs
(`$URL/ui/` operator UI, `$URL/pwa/` driver PWA).

## Rules

- Never commit, push, or open PRs as part of a deploy.
- Never run `cdk destroy`, and never delete the S3 bucket or the data volume.
- If a new server-side file is needed in production, add it to the allowlist in `infra/scripts/bundle.sh` first;
  files not listed there are not deployed.

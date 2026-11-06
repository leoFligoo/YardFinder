# Yard Finder · infra

One EC2 instance runs both apps behind CloudFront. No SSH: deploys go S3 → SSM.

```
browser ─HTTPS─► CloudFront (*.cloudfront.net, caching off)
                    │ HTTP :80 (SG: CloudFront prefix list only)
                    ▼
                EC2 t3.small (AL2023) ── nginx ─┬─ /ui/, /api/ → compartir_ui.py :8766
                                                ├─ /pwa/       → static PWA files
                                                └─ /           → redirect to /ui/
                /var/lib/yard (own EBS volume): inventario.db, salida/   ← the "database"
S3 bucket: releases/ (30d), db-backups/ (90d)
```

## First time

```bash
cd infra
npm install
export AWS_PROFILE=fligoo-hackathon-admin     # us-east-1; SSO login first
cdk diff                                       # review
cdk deploy                                     # ~5 min (CloudFront is the slow part)
./scripts/deploy.sh                            # first release (waits for bootstrap + SSM)
```

## Every deploy

```bash
./scripts/deploy.sh               # code only; the server DB is never overwritten
./scripts/deploy.sh --reseed-db   # also replace the server DB with the repo's inventario.db
                                  # (the old one is saved in /var/lib/yard/backups/)
./scripts/logs.sh                 # app + nginx + bootstrap logs
./scripts/shell.sh                # SSM shell (needs session-manager-plugin)
```

A deploy builds an allowlisted tarball (`scripts/bundle.sh`), uploads it to S3, and runs
`remote/apply.sh` on the instance through SSM. `apply.sh` installs the release, swaps the
`/opt/yard/current` symlink, restarts the app, checks `/api/patio`, `/ui/` and `/pwa/`, and
**rolls back** if any fails. The last 3 releases are kept.

## Data rules

- `inventario.db` and `salida/` live on the data volume, not in the release. They are seeded
  from the repo **only if absent**. Once the PWA writes to the DB, deploys never touch it.
- Nightly backup (systemd timer, 03:00 UTC) → `s3://<bucket>/db-backups/`.
- The data volume has `deleteOnTermination: false`, but replacing the instance is still a manual
  restore. Changing `bootstrap.sh` does **not** replace the instance (`userDataCausesReplacement: false`).

## When the PWA gets a writable API

Edit `YARD_ENTRYPOINT` in `/etc/yard/yard.env` (e.g. `interfaz.py`) and `systemctl restart yard`,
or point nginx's `yard_app` upstream at a new service. The release already ships `interfaz.py`,
`interfaz.html` and `vendor/leaflet`. Add any new server file to the allowlist in `scripts/bundle.sh`.

## Security model

- **Only our CloudFront can reach the instance**, enforced twice: the security group allows port 80
  only from the CloudFront origin-facing prefix list, and nginx returns 403 unless the request carries
  `X-Origin-Verify` (a random 40-char secret in Secrets Manager that only this distribution adds).
  The prefix list alone admits *any* CloudFront distribution; the header closes that.
- No SSH, no inbound ports besides 80. Shell access is SSM only. IMDSv2 required, volumes encrypted.
- The instance role is least-privilege: read `releases/*`, put-only `db-backups/*`, read the one secret.
- S3 bucket: private, encrypted, TLS-only. CloudFront adds HSTS, nosniff, frame and referrer headers.
- Rotating the secret: change it in Secrets Manager, `cdk deploy` (updates CloudFront), then
  `./scripts/deploy.sh` (updates nginx). Requests fail with 403 between the two steps.

## Known gaps (MVP)

- CloudFront → EC2 is plain HTTP (inside AWS). Real end-to-end TLS needs a domain + certificate.
- **No user auth:** `/ui/` and `/api/patio` are public (VINs, crops). Fine for mock data; needs a decision
  (basic auth, Cognito, ...) before real data.
- The `*.cloudfront.net` default certificate allows TLS 1.0 (a CloudFront limitation without a custom domain).
- Single instance, no HA. `cdk destroy` keeps the S3 bucket and the data volume.
- Prefix list ID `pl-3b927c52` is for us-east-1 (`cdk.json` context `cloudfrontPrefixListId`).

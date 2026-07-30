# Deploying to Railway

Five Railway services in one project, all pointed at this same GitHub repo:

| Service | Type | Root/Dockerfile | Notes |
|---|---|---|---|
| `postgres` | Railway's Postgres plugin | — | Add from Railway's template gallery |
| `redis` | Railway's Redis plugin | — | Add from Railway's template gallery |
| `backend` | Docker service | `apps/backend/Dockerfile` | Runs `prisma migrate deploy` on every boot before starting |
| `workers` | Docker service | `workers/Dockerfile` | Background job processor, no public port needed |
| `frontend` | Docker service | `apps/frontend/Dockerfile` | Public-facing, needs build-time env vars (see below) |

For each Docker service, set **"Dockerfile Path"** to the path above and **"Build Context"** to the repo root (`.`) — the Dockerfiles expect to see the whole monorepo, not just their own folder.

## Environment variables

Generate two random secrets once (any password generator, 20+ characters) and reuse them everywhere below:
- `SESSION_SECRET_VALUE`
- `SHARED_SECRET_VALUE`

**backend:**
- `DATABASE_URL` — from the Postgres plugin's connection variables (Railway auto-links these if you reference `${{Postgres.DATABASE_URL}}`)
- `REDIS_URL` — same idea, `${{Redis.REDIS_URL}}`
- `ANTHROPIC_API_KEY` — your Claude API key
- `API_SHARED_SECRET` — `SHARED_SECRET_VALUE`
- `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — for uploaded invoice files. **Required on Railway** — the container's local disk is wiped on every redeploy, so without these, every uploaded invoice file becomes a broken link the next time you deploy. Create an S3 bucket, an IAM user scoped to just that bucket (`s3:PutObject`, `s3:GetObject`), and set these four. If unset, the backend silently falls back to local disk (fine for local dev, not for Railway).
- `S3_PUBLIC_URL` (optional) — only needed if the bucket is behind a CDN/custom domain rather than the default `https://<bucket>.s3.amazonaws.com`.

  **Bucket privacy tradeoff:** this stores files under a public-read bucket policy (anyone with the exact random URL can view a given invoice file, though there's no way to browse/list them). This matches the current local-disk behavior — `/uploads/*` is also unauthenticated today — so it's not a new gap, just carrying forward an existing one. If you want files locked down properly, that needs presigned URLs with expiry instead of permanent public links — a follow-up, not done here.

**workers:**
- `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY` — same as backend

**frontend:**
- `NEXT_PUBLIC_API_URL` — the backend service's public Railway URL (e.g. `https://audix-backend.up.railway.app`)
- `NEXT_PUBLIC_API_SHARED_SECRET` — `SHARED_SECRET_VALUE` (**must also be added as a Build Variable**, not just a runtime one — Next.js bakes `NEXT_PUBLIC_*` vars into the client bundle at build time)
- `APP_PASSWORD` — the actual password you and your HR manager will type to sign in
- `SESSION_SECRET` — `SESSION_SECRET_VALUE`

## First deploy

1. Create an S3 bucket (any AWS region) and an IAM user with a policy scoped to just that bucket (`s3:PutObject`, `s3:GetObject`) — save the access key ID/secret. Set the bucket's public access block settings to allow a public-read bucket policy (see the privacy tradeoff note above).
2. Create the Railway project, add Postgres and Redis first.
3. Add the three Docker services, pointing each at this repo with the Dockerfile paths above.
4. Set the environment variables per the table above.
5. Deploy `backend` first (it applies migrations on boot) — check its logs for "Nest application successfully started".
6. Deploy `workers` and `frontend`.
7. Once `frontend` is live, generate a public domain for it in Railway's settings (Settings → Networking → Generate Domain) — that's the link to share.
8. `backend` doesn't need a public domain unless you want to hit its API directly; `frontend` proxies to it via `NEXT_PUBLIC_API_URL` from the browser.

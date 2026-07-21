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

**workers:**
- `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY` — same as backend

**frontend:**
- `NEXT_PUBLIC_API_URL` — the backend service's public Railway URL (e.g. `https://audix-backend.up.railway.app`)
- `NEXT_PUBLIC_API_SHARED_SECRET` — `SHARED_SECRET_VALUE` (**must also be added as a Build Variable**, not just a runtime one — Next.js bakes `NEXT_PUBLIC_*` vars into the client bundle at build time)
- `APP_PASSWORD` — the actual password you and your HR manager will type to sign in
- `SESSION_SECRET` — `SESSION_SECRET_VALUE`

## First deploy

1. Create the Railway project, add Postgres and Redis first.
2. Add the three Docker services, pointing each at this repo with the Dockerfile paths above.
3. Set the environment variables per the table above.
4. Deploy `backend` first (it applies migrations on boot) — check its logs for "Nest application successfully started".
5. Deploy `workers` and `frontend`.
6. Once `frontend` is live, generate a public domain for it in Railway's settings (Settings → Networking → Generate Domain) — that's the link to share.
7. `backend` doesn't need a public domain unless you want to hit its API directly; `frontend` proxies to it via `NEXT_PUBLIC_API_URL` from the browser.

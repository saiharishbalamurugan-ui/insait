# Audix

AI-powered invoice auditing SaaS. Audix ingests vendor invoices, matches them
against QuickBooks Online timesheets, and uses Claude to flag discrepancies
(overbilling, duplicate charges, rate mismatches, etc.) with a natural-language
explanation and a risk score.

## Monorepo layout

```
apps/backend/    NestJS API — auth, invoices, audits, QuickBooks OAuth
apps/frontend/   Next.js app — dashboard, invoices, AI audit UI, chat widget
workers/         BullMQ background workers — AI audit engine, email/OCR ingestion
database/        Prisma schema, migrations, seed script (shared by backend + workers)
infrastructure/  docker-compose (Postgres + Redis), docs
```

See [infrastructure/docs/ARCHITECTURE.md](infrastructure/docs/ARCHITECTURE.md) for
how the pieces fit together and [infrastructure/docs/SETUP.md](infrastructure/docs/SETUP.md)
for local setup instructions.

## Quick start

```
docker compose -f infrastructure/docker/docker-compose.yml up -d
npm install
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:3000
npm run dev:workers
```

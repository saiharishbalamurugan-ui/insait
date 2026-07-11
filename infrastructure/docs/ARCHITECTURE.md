# Architecture

## Services

- **apps/frontend** — Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui,
  React Query for data fetching, Framer Motion for the AI audit animation.
  Talks to the backend only through `src/lib/api-client.ts`.
- **apps/backend** — NestJS API. Owns auth (JWT), invoices, audit results,
  QuickBooks OAuth, and exposes `/health`. Uses Prisma (from `database/`) to
  talk to Postgres.
- **workers** — BullMQ workers (Redis-backed queues) for anything slow or
  external-API-bound: the AI audit engine (Claude), QuickBooks timesheet sync,
  email polling (Microsoft Graph), and OCR extraction (Azure Document
  Intelligence). Kept out of the request/response path of the backend.
- **database** — Single Prisma schema shared by backend and workers so both
  read/write the same models with the same generated client.

## Data flow (AI audit)

1. An invoice arrives (manual upload in Phase 1, or email ingestion in Phase 4)
   and is persisted via the backend.
2. The backend enqueues an `ai-audit` job on a BullMQ queue.
3. `workers/src/processors/ai-audit.processor.ts` picks it up, loads the
   invoice plus its matched QuickBooks timesheet, and calls Claude to produce
   a risk score, `DiscrepancyType` classification(s), and an explanation.
4. Results are persisted as `AuditFinding` rows (one per discrepancy) and a
   summary `AuditReport` row.
5. The frontend polls/subscribes via React Query and renders the animated
   "reading → extracting → comparing → generating" sequence, ending on the
   report.

## Infrastructure

Postgres and Redis run locally via `infrastructure/docker/docker-compose.yml`.
In this Phase 0 setup there is no orchestration beyond Docker Compose — no
Kubernetes, no managed cloud services. Environment variables (see
`.env.example`) configure every external integration; features are inert
until their credentials are present.

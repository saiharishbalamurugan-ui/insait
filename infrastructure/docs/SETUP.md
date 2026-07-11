# Local setup

## Prerequisites

- Node.js 20+ (LTS)
- Docker Desktop (for Postgres + Redis)

## Steps

1. Copy `.env.example` to `.env` at the repo root and fill in `JWT_SECRET`
   (any long random string). Leave the Phase 2–4 integration keys blank until
   you have them — those features simply stay disabled.
2. Start the databases:
   ```
   docker compose -f infrastructure/docker/docker-compose.yml up -d
   ```
3. Install dependencies from the repo root (installs all workspaces):
   ```
   npm install
   ```
4. Generate the Prisma client, run migrations, and seed sample data:
   ```
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
5. Start the backend and frontend in separate terminals:
   ```
   npm run dev:backend
   npm run dev:frontend
   ```
6. Visit http://localhost:3000 — the dashboard should show both the frontend
   and backend health checks as green.

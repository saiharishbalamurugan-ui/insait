FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY workers/package.json workers/package.json
COPY database/package.json database/package.json
RUN npm ci

COPY database database
COPY workers workers
RUN npm run db:generate
RUN npm run build -w workers

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/database/generated ./database/generated
COPY --from=builder /app/database/package.json ./database/package.json
COPY --from=builder /app/workers/dist ./workers/dist
COPY --from=builder /app/workers/package.json ./workers/package.json

CMD ["node", "workers/dist/index.js"]

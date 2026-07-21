FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY workers/package.json workers/package.json
COPY database/package.json database/package.json
RUN npm ci

COPY database database
COPY apps/backend apps/backend
RUN npm run db:generate
RUN npm run build -w apps/backend

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/database/generated ./database/generated
COPY --from=builder /app/database/prisma ./database/prisma
COPY --from=builder /app/database/package.json ./database/package.json
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=database/prisma/schema.prisma && node apps/backend/dist/main.js"]

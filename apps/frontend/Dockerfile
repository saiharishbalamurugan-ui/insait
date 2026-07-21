FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY workers/package.json workers/package.json
COPY database/package.json database/package.json
RUN npm ci

COPY apps/frontend apps/frontend

# NEXT_PUBLIC_* vars are baked into the client bundle at build time, not read at
# runtime — they must be passed as build args, not just runtime env vars.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_SHARED_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_SHARED_SECRET=$NEXT_PUBLIC_API_SHARED_SECRET

RUN npm run build -w apps/frontend

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]

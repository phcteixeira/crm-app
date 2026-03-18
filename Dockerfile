# 1. Install dependencies
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 2. Build the application
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept DATABASE_URL as a build argument (only needed for prisma generate + next build, not runtime)
ARG DATABASE_URL=postgresql://user:pass@localhost:5432/db?sslmode=disable
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Build Worker (must be after build so standalone folder exists)
RUN npm run build:worker

# 3. Production runner
FROM node:20-slim AS runner
WORKDIR /app

# Required for Prisma engine (OpenSSL) and Next.js
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3005

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs --ingroup nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3005

CMD ["node", "server.js"]

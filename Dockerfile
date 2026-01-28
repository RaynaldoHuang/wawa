# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Optional: Copy node_modules if not fully covered by standalone
COPY --from=builder /app/node_modules ./node_modules

# Create storages directory for WA sessions
RUN mkdir -p storages/wa-sessions && chown -R nextjs:nodejs storages

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]

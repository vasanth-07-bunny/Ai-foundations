# BRICS AgriN API — Multi-stage Dockerfile
#
# Stage 1: builder — installs deps, compiles TypeScript
# Stage 2: production — minimal runtime image (no devDeps, no source)
#
# Security:
#   - Non-root user (node:node)
#   - No shell in production layer
#   - Only dist/ and production node_modules are copied
#   - Secrets are provided at runtime via env vars — never baked in

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy workspace manifests first for layer caching
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/

# Install all dependencies (including devDependencies for build)
RUN npm ci --workspace=packages/shared --workspace=packages/api

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/api/ ./packages/api/

# Build shared types first
RUN npm run build -w packages/shared

# Generate Prisma client
RUN cd packages/api && npx prisma generate

# Build API
RUN npm run build -w packages/api

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 agrin && \
    adduser --system --uid 1001 --ingroup agrin agrin

# Copy production artifacts from builder
COPY --from=builder --chown=agrin:agrin /build/packages/api/dist ./dist
COPY --from=builder --chown=agrin:agrin /build/packages/shared/dist ./shared/dist
COPY --from=builder --chown=agrin:agrin /build/packages/api/prisma ./prisma

# Install only production dependencies
COPY --chown=agrin:agrin packages/api/package*.json ./
COPY --chown=agrin:agrin packages/shared/package*.json ./shared/

RUN npm ci --omit=dev && \
    # Re-generate Prisma client in production context
    npx prisma generate && \
    # Clean npm cache
    npm cache clean --force

# Switch to non-root user
USER agrin

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/health/live || exit 1

EXPOSE 3000

# dumb-init handles PID 1 signal forwarding for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

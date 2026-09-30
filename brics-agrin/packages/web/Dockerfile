# BRICS AgriN Web — Multi-stage Dockerfile
#
# Stage 1: builder — installs deps, builds Vite PWA
# Stage 2: production — nginx serving static assets
#
# The web container serves only static files.
# All API calls are proxied to the API container by nginx.

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/

RUN npm ci --workspace=packages/shared --workspace=packages/web

COPY packages/shared/ ./packages/shared/
COPY packages/web/ ./packages/web/

RUN npm run build -w packages/shared
RUN npm run build -w packages/web

# ── Stage 2: Production (nginx) ───────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY packages/web/nginx.conf /etc/nginx/conf.d/agrin.conf

# Copy built assets
COPY --from=builder /build/packages/web/dist /usr/share/nginx/html

# Non-root nginx (nginx 1.19+ supports this with listen on 8080)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

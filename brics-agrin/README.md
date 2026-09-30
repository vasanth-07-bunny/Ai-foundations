# BRICS AgriN

**AI-powered Digital Agriculture Network for Small and Marginal Farmers**

BRICS AgriN is an interoperable digital public good that delivers real-time, localised agro-advisories using AI, satellite data, soil health information, and weather forecasts — directly to small and marginal farmers across BRICS and emerging economies.

---

## Architecture Overview

```
Farmer PWA (React + TypeScript + i18n)
        ↓ HTTPS
API Gateway (Express + JWT + Rate Limiting)
        ↓
┌───────────────┬───────────────┬────────────────┐
│  Farm APIs    │ Advisory      │  Diagnostic    │
│  /farms       │ Engine        │  Pipeline      │
│  /fields      │ (Rules + AI)  │  (ML Model)    │
│  /crop-cycles │               │                │
└───────────────┴───────┬───────┴───────┬────────┘
                        ↓               ↓
              ┌─────────────────┐  ┌──────────────┐
              │ Data Aggregator │  │ Job Queue    │
              │ (Weather/Sat/   │  │ (Bull/Redis) │
              │  Soil parallel) │  └──────────────┘
              └────────┬────────┘
                       ↓
              PostgreSQL/PostGIS ← Redis Cache
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for full design documentation.

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15 with PostGIS (or use Docker)

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env with your values — see comments in file
```

### 2. Start infrastructure

```bash
docker-compose up postgres redis
```

### 3. Install dependencies

```bash
npm install
```

### 4. Set up database

```bash
cd packages/api
npm run db:migrate
npm run db:seed
```

### 5. Start development servers

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Web
npm run dev:web
```

The API runs at `http://localhost:3000`.  
The web app runs at `http://localhost:5173`.  
API docs (Swagger) at `http://localhost:3000/api-docs`.

---

## Environment Variables

Copy `.env.example` to `.env`. Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | JWT signing secret (min 32 chars, random) |
| `JWT_REFRESH_SECRET` | JWT refresh secret (different from access, min 32 chars) |
| `OPENMETEO_BASE_URL` | Weather API base URL (default: Open-Meteo, no key needed) |

Optional (enables additional capabilities):

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Enables AI-enhanced advisory explanations |
| `SATELLITE_BASE_URL` + `SATELLITE_API_KEY` | Real satellite data provider |

**Never commit `.env` to source control.**

---

## Running Tests

```bash
# All tests
npm run test:api

# Specific test suites
cd packages/api
npx vitest run tests/unit/          # Unit tests
npx vitest run tests/api/           # API tests
npx vitest run tests/integration/   # Integration tests
npx vitest run tests/security/      # Security tests

# With coverage
npm run test:coverage
```

---

## Production Deployment

### Docker Compose (single server)

```bash
docker-compose --profile production up -d
```

### Environment-specific setup

1. Generate secrets: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Set `NODE_ENV=production`
3. Configure a real PostgreSQL instance with PostGIS
4. Configure Redis with authentication
5. Set up object storage (S3-compatible) for diagnostic images
6. Configure reverse proxy (nginx/Caddy) with TLS

### Database migrations in production

```bash
cd packages/api && npm run db:migrate
```

---

## Adding a New BRICS Country

The platform is designed to be country-agnostic. Adding a new country requires:

1. **Register data providers** in `packages/api/src/providers/registry.ts`
2. **Add translation** in `packages/web/src/i18n/locales/{lang}.json`
3. **Add country to constants** in `packages/shared/src/constants/index.ts`
4. **Seed data sources** via `packages/api/src/db/seed.ts`

No changes to core business logic are needed.

---

## CI/CD

Every PR must pass the full quality gate in `.github/workflows/ci.yml`:

1. ✅ ESLint
2. ✅ TypeScript typecheck
3. ✅ Vitest (unit + integration + API + security)
4. ✅ Build
5. ✅ Secret scan (gitleaks)
6. ✅ Dependency audit
7. ✅ Docker build

---

## Project Structure

```
brics-agrin/
├── packages/
│   ├── api/          # Express API (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── config/         # Env validation
│   │   │   ├── domain/         # Domain type interfaces
│   │   │   ├── providers/      # Weather/Satellite/Soil adapters
│   │   │   ├── services/
│   │   │   │   ├── advisory/   # Agro-advisory engine + rules
│   │   │   │   ├── diagnostic/ # Disease diagnostic pipeline
│   │   │   │   ├── auth/       # Authentication service
│   │   │   │   └── farm/       # Farm/Field/CropCycle service
│   │   │   ├── api/v1/         # HTTP route handlers
│   │   │   ├── middleware/     # Auth, rate limit, validation
│   │   │   ├── queue/          # Bull job queue
│   │   │   ├── cache/          # Redis client
│   │   │   └── observability/  # Logger, metrics
│   │   ├── prisma/             # Schema + migrations
│   │   └── tests/              # Unit + integration + API + security
│   │
│   ├── web/          # React PWA (TypeScript + Vite + TailwindCSS)
│   │   └── src/
│   │       ├── api/            # Typed API client
│   │       ├── components/     # Reusable UI components
│   │       ├── pages/          # Route-level pages
│   │       ├── store/          # Zustand auth store
│   │       ├── hooks/          # Custom hooks
│   │       └── i18n/           # en, hi, pt translations
│   │
│   └── shared/       # Shared types, schemas, constants
│
├── .github/workflows/ # CI quality gate
├── docker-compose.yml
├── ARCHITECTURE.md
└── README.md
```

---

## License

This project is designed as a **Digital Public Good** — open, reusable, and interoperable.
Licensed under the MIT License.

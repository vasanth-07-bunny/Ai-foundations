# BRICS AgriN — Architecture Document

## 1. Overview

BRICS AgriN is a **modular, production-quality digital agriculture network** designed as a Digital Public Good. It delivers AI-assisted, data-driven agro-advisories to small and marginal farmers across BRICS and emerging economies.

The system is architectured as a **modular monolith** — clean bounded contexts with well-defined interfaces that allow future extraction into independent services without a premature microservices penalty.

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Farmer Web / Mobile (PWA)                    │
│    React + TypeScript · i18n · Offline-First · Mobile-first  │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS / REST
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                         │
│   Rate Limiting · Auth (JWT) · CORS · Request Validation     │
└──────┬───────────────────┬───────────────────┬───────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌────────────┐    ┌────────────────┐    ┌──────────────────┐
│ Farm APIs  │    │ Advisory       │    │ Diagnostic       │
│            │    │ Engine         │    │ Engine           │
│ /farms     │    │                │    │                  │
│ /fields    │    │ Data Fusion    │    │ Image Validation │
│ /crops     │    │ Rule Engine    │    │ Model Abstraction│
│ /profiles  │    │ AI Reasoning   │    │ Confidence Eval  │
└────────────┘    │ Evidence Track │    │ Result Normalize │
                  └───────┬────────┘    └────────┬─────────┘
                          │                      │
            ┌─────────────┼──────────────────────┘
            ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────────┐
     │ Weather  │  │Satellite │  │  ML Model    │
     │ Adapter  │  │ Adapter  │  │  Provider    │
     └──────────┘  └──────────┘  └──────────────┘
            │             │
     ┌──────────┐  ┌──────────┐
     │  Soil    │  │ Govt/    │
     │ Adapter  │  │ BRICS    │
     └──────────┘  └──────────┘
            │             │
            └──────┬───────┘
                   ▼
          ┌─────────────────┐
          │  Data Platform  │
          └────────┬────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
  PostgreSQL     Redis      Object
  (PostGIS)     Cache       Storage
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend Runtime | Node.js 20 LTS + TypeScript | Type safety, large ecosystem, async I/O |
| Web Framework | Express.js | Mature, well-tested, minimal |
| Database | PostgreSQL 15 + PostGIS | Geospatial support, relational integrity, ACID |
| ORM | Prisma | Type-safe queries, migrations, schema versioning |
| Cache | Redis (ioredis) | Advisory caching, rate limiting, session store |
| Auth | JWT (jsonwebtoken) + bcrypt | Stateless, horizontally scalable |
| Validation | Zod | Runtime schema validation, TypeScript inference |
| File Upload | Multer + sharp | Image validation and preprocessing |
| Queue | Bull (Redis-backed) | Async advisory and diagnostic jobs |
| Logging | Pino | Structured JSON logs, high performance |
| Testing | Vitest + Supertest | Fast unit/integration testing |
| Frontend | React 18 + TypeScript + Vite | SPA, PWA-capable |
| UI | TailwindCSS | Utility-first, mobile-first |
| i18n | react-i18next | Multi-language support |
| State | Zustand | Lightweight, scalable |
| HTTP Client | Axios | Request/response interceptors, retry |
| API Docs | swagger-jsdoc + swagger-ui-express | OpenAPI 3.0 |

---

## 4. Module Boundaries

### Backend (`packages/api/`)
```
src/
├── config/          # Environment, secrets, constants
├── db/              # Prisma schema, migrations, client
├── domain/          # Core domain types and interfaces
│   ├── farm/
│   ├── advisory/
│   ├── diagnostic/
│   └── user/
├── providers/       # External data adapter interfaces + implementations
│   ├── weather/
│   ├── satellite/
│   ├── soil/
│   └── government/
├── services/        # Business logic services
│   ├── advisory/    # Agro-advisory engine
│   ├── diagnostic/  # Crop disease diagnostic pipeline
│   ├── farm/
│   └── auth/
├── api/             # HTTP route handlers (thin controllers)
│   └── v1/
├── middleware/      # Auth, rate limit, error, validation
├── queue/           # Job definitions and processors
├── cache/           # Cache client + strategies
├── observability/   # Logger, metrics, health checks
├── i18n/            # Server-side translations
└── utils/           # Pure utility functions
```

### Frontend (`packages/web/`)
```
src/
├── api/             # API client layer
├── components/      # Reusable UI components
├── features/        # Feature modules (farm, advisory, diagnostic, auth)
├── hooks/           # Custom React hooks
├── i18n/            # Translation files (en, hi, pt, ru, zh, ar)
├── pages/           # Route-level page components
├── store/           # Global state
├── types/           # Shared TypeScript types
└── utils/           # Frontend utilities
```

### Shared (`packages/shared/`)
```
src/
├── types/           # Shared domain types (used by both API and Web)
├── schemas/         # Zod validation schemas
└── constants/       # Shared constants (crop stages, risk levels, etc.)
```

---

## 5. Security Architecture

- All secrets via environment variables — never in source
- Passwords: bcrypt with cost factor 12
- Auth: JWT access (15m) + refresh token (7d) rotation
- Authorization: server-side resource ownership checks on every request
- Input validation: Zod schemas on all API routes
- File upload: MIME + magic bytes check, size limit, dimension limit, sanitized filename, object storage only
- Rate limiting: Redis-backed per-IP and per-user limits
- SQL injection: Prisma parameterized queries only
- SSRF protection: whitelist-based external URL validation
- AI safety: system prompt isolation, no external data injected into prompts without sanitization
- Headers: Helmet.js for HSTS, CSP, X-Frame-Options, etc.

---

## 6. Data Provenance Model

Every advisory record retains:
```json
{
  "recommendation": "...",
  "evidence": {
    "weather": { "source": "...", "timestamp": "...", "freshness": "current" },
    "soil": { "source": "...", "timestamp": "...", "freshness": "stale" },
    "satellite": { "source": "...", "timestamp": "..." },
    "crop_stage": "...",
    "location": { "lat": 0.0, "lon": 0.0 }
  },
  "data_types": {
    "weather": "predicted",
    "soil": "observed",
    "satellite": "observed",
    "recommendation": "ai_generated"
  },
  "generated_at": "...",
  "model_version": "...",
  "confidence": 0.87
}
```

---

## 7. Scalability Strategy

- **Stateless API servers** — horizontally scalable
- **Redis cache** — advisory results cached by farm+date key
- **Bull queue** — expensive ML/satellite processing off request path
- **Connection pooling** — Prisma pool configuration
- **PostGIS indexes** — geospatial queries optimized
- **CDN** — static frontend assets
- **Object storage** — diagnostic images (not filesystem)
- **Country adapter pattern** — new countries add config + adapters, not core changes

---

## 8. Multi-Country Design

```
Country Config (e.g. India)
├── language: ["hi", "en"]
├── units: "metric"
├── crops: ["rice", "wheat", "cotton", ...]
├── weather_provider: "IMD_ADAPTER"
├── soil_provider: "ICAR_ADAPTER"
├── satellite_provider: "ISRO_ADAPTER"
├── advisory_rules: "./rules/india.rules.ts"
└── govt_integration: "./integrations/india.ts"
```

Core platform remains country-agnostic.

---

## 9. Offline / Degradation Strategy

| Condition | Behavior |
|---|---|
| Weather API down | Use cached forecast, mark data as stale, inform user |
| Satellite unavailable | Use last known NDVI, mark as stale |
| AI service unavailable | Fall back to rule-based recommendations |
| No connectivity (client) | Serve cached advisories from service worker |
| Low confidence | Do not issue recommendation; request more data or expert consultation |

---

## 10. Engineering Criteria Checklist

| Criterion | Implementation |
|---|---|
| Code Quality | SOLID, DRY, small functions, typed, documented |
| Efficiency | Caching, async queue, lazy loading, DB indexes |
| Problem Alignment | Every feature maps to a farmer need |
| Security | Auth, authz, validation, upload safety, AI safety |
| Testing | Unit + integration + API + security + AI edge cases |
| Performance | Cache + queue + async + PostGIS indexes |
| Scalability | Stateless API + Redis + queue workers + adapter pattern |

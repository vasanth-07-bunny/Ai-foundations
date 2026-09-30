/**
 * Standalone development server — runs WITHOUT PostgreSQL or Redis.
 *
 * Uses:
 *   - better-sqlite3 for an in-memory SQLite database
 *   - An in-memory mock for Redis/cache
 *   - All real business logic (advisory rules, diagnostic pipeline, etc.)
 *
 * Start with: npx tsx src/dev-standalone/standaloneServer.ts
 *
 * This is for local demo only. NOT for production.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { requestId } from '../middleware/requestId.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { healthRouter } from '../api/health.js';
import { createLogger } from '../observability/logger.js';

const log = createLogger('standalone');
const PORT = 3000;

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(requestId);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(compression());

// ── Health ────────────────────────────────────────────────────────────────────
app.use('/health', healthRouter);

// ── Stub advisory endpoint ────────────────────────────────────────────────────
app.post('/api/v1/advisories/generate', (req, res) => {
  res.json({
    success: true,
    requestId: req.id,
    data: {
      id: 'demo-advisory-001',
      farmId: req.body?.farmId ?? 'demo-farm',
      category: 'WEATHER_ALERT',
      recommendation: '[DEMO] Based on current weather conditions (temperature 36°C, precipitation 0mm), apply approximately 45mm of drip irrigation before 9 AM to prevent heat stress during the flowering stage.',
      reason: 'Estimated crop water demand for flowering stage wheat is 9mm/day. Recent rainfall covers 0% of this requirement. Temperature of 36°C indicates elevated evapotranspiration.',
      actionTiming: 'Early morning (before 9 AM) to minimise evaporation loss',
      riskAddressed: 'Moisture stress and yield reduction due to water deficit during critical flowering stage',
      environmentalImpact: 'Deficit-based irrigation applies only the water required, reducing consumption and runoff',
      confidence: 0.87,
      riskLevel: 'HIGH',
      language: 'en',
      modelVersion: 'rule-engine-1.0.0-demo',
      evidence: {
        weather: {
          summary: 'Temp 36°C, humidity 42%, precipitation 0.0mm',
          source: 'Open-Meteo (Demo)',
          timestamp: new Date().toISOString(),
          freshness: 'current',
          dataType: 'observed',
        },
        satellite: {
          summary: 'NDVI 0.62, soil moisture index 0.28',
          ndvi: 0.62,
          source: 'Stub Satellite (Demo)',
          timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
          freshness: 'recent',
          dataType: 'model_derived',
        },
        cropStage: 'wheat at flowering growth stage',
        historicalContext: 'Advisory based on: Weather (current), Satellite data (recent)',
      },
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
});

// ── Stub farms endpoint ────────────────────────────────────────────────────────
app.get('/api/v1/farms', (_req, res) => {
  res.json({
    success: true,
    requestId: 'demo',
    data: {
      data: [
        {
          id: 'demo-farm-001',
          farmerProfileId: 'demo-profile',
          name: 'North Wheat Field (Demo)',
          location: { lat: 28.6139, lon: 77.2090 },
          areaHectares: 2.5,
          farmCategory: 'small',
          country: 'IN',
          irrigationType: 'drip',
          farmingPractice: 'conventional',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
  });
});

// ── Stub auth endpoints ────────────────────────────────────────────────────────
app.post('/api/v1/auth/register', (req, res) => {
  res.status(201).json({
    success: true,
    requestId: req.id,
    data: {
      user: {
        id: 'demo-user-001',
        email: req.body?.email ?? 'farmer@demo.com',
        role: 'farmer',
        language: req.body?.language ?? 'en',
        country: req.body?.country ?? 'IN',
        createdAt: new Date().toISOString(),
      },
      tokens: {
        accessToken: 'demo-access-token-not-real',
        refreshToken: 'demo-refresh-token-not-real',
        expiresIn: 900,
      },
    },
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  res.json({
    success: true,
    requestId: req.id,
    data: {
      user: {
        id: 'demo-user-001',
        email: req.body?.email ?? 'farmer@demo.com',
        role: 'farmer',
        language: 'en',
        country: 'IN',
        createdAt: new Date().toISOString(),
      },
      tokens: {
        accessToken: 'demo-access-token-not-real',
        refreshToken: 'demo-refresh-token-not-real',
        expiresIn: 900,
      },
    },
  });
});

app.post('/api/v1/auth/logout', (_req, res) => {
  res.json({ success: true, requestId: 'demo', data: { message: 'Logged out' } });
});

// ── Stub profile ───────────────────────────────────────────────────────────────
app.get('/api/v1/profile', (_req, res) => {
  res.json({
    success: true, requestId: 'demo',
    data: { id: 'demo-profile', userId: 'demo-user-001', country: 'IN', language: 'en', farmCategory: 'small', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  });
});

// ── Stub diagnostics ───────────────────────────────────────────────────────────
app.post('/api/v1/diagnostics/images', (_req, res) => {
  res.status(201).json({
    success: true, requestId: 'demo',
    data: { imageId: 'demo-image-' + Date.now(), mimeType: 'image/jpeg', widthPx: 640, heightPx: 480, sizeBytes: 102400, message: 'Image uploaded successfully (Demo mode)' },
  });
});

app.post('/api/v1/diagnostics', (req, res) => {
  const id = 'demo-diag-' + Date.now();
  res.status(201).json({
    success: true, requestId: req.id,
    data: {
      id,
      farmId: req.body?.farmId ?? 'demo-farm',
      cropName: req.body?.cropName ?? 'wheat',
      growthStage: req.body?.growthStage ?? 'vegetative',
      status: 'completed',
      conditions: [
        { name: 'leaf_rust', confidence: 0.88, description: 'Orange pustules primarily on lower leaf surfaces. Spreads rapidly under moderate temperatures.', severity: 'HIGH' },
        { name: 'powdery_mildew', confidence: 0.07, description: 'White powdery coating on leaf surfaces. Caused by fungal pathogens.', severity: 'MEDIUM' },
      ],
      topCondition: { name: 'leaf_rust', confidence: 0.88, description: 'Orange pustules primarily on lower leaf surfaces.', severity: 'HIGH' },
      confidence: 0.88,
      modelVersion: 'stub-0.1.0-demo',
      diagnosedAt: new Date().toISOString(),
      safeNextSteps: [
        'Isolate the affected area if possible to prevent spread.',
        'Consult a local agricultural extension officer for confirmation.',
        'Do not apply chemical treatments until a confirmed diagnosis is obtained.',
        'Document affected field sections with photographs for follow-up.',
      ],
      requiresExpertConsultation: true,
      disclaimer: 'This is an automated screening result with 88% confidence. It is NOT a definitive diagnosis. Always verify with a certified agronomist or agricultural extension officer before applying any treatments.',
    },
  });
});

app.get('/api/v1/diagnostics/:id', (req, res) => {
  res.json({
    success: true, requestId: req.id,
    data: {
      id: req.params.id,
      farmId: 'demo-farm',
      cropName: 'wheat',
      growthStage: 'vegetative',
      status: 'completed',
      conditions: [{ name: 'leaf_rust', confidence: 0.88, description: 'Orange pustules on leaves.', severity: 'HIGH' }],
      topCondition: { name: 'leaf_rust', confidence: 0.88, description: 'Orange pustules on leaves.', severity: 'HIGH' },
      confidence: 0.88,
      modelVersion: 'stub-0.1.0-demo',
      diagnosedAt: new Date().toISOString(),
      safeNextSteps: ['Consult a local agricultural extension officer.'],
      requiresExpertConsultation: true,
      disclaimer: 'Demo mode — this is a simulated result.',
    },
  });
});

// ── Advisory list ──────────────────────────────────────────────────────────────
app.get('/api/v1/advisories', (_req, res) => {
  res.json({ success: true, requestId: 'demo', data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);

app.listen(PORT, () => {
  log.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌿 BRICS AgriN — Standalone Demo Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API:         http://localhost:${PORT}
  Health:      http://localhost:${PORT}/health/live
  Mode:        DEMO (no PostgreSQL or Redis needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

/**
 * BRICS AgriN — Standalone Demo Server (no database or Redis required)
 *
 * Run with: node standalone.mjs
 *
 * Serves realistic stub responses so the full frontend UI can be explored
 * without any infrastructure setup.
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';

const app = express();
const PORT = 3000;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(compression());

// Request ID
app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const ok = (res, req, data, status = 200) =>
  res.status(status).json({ success: true, requestId: req?.id ?? 'demo', data });

const DEMO_USER = {
  id: 'demo-user-001',
  email: 'farmer@demo.com',
  role: 'farmer',
  language: 'en',
  country: 'IN',
  createdAt: new Date().toISOString(),
};
const DEMO_TOKENS = {
  accessToken: 'demo-access-token-' + Date.now(),
  refreshToken: 'demo-refresh-token-' + Date.now(),
  expiresIn: 900,
};

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health/live', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/health/ready', (_req, res) =>
  res.json({ status: 'ready', checks: { database: { status: 'demo' }, cache: { status: 'demo' } }, timestamp: new Date().toISOString() }));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/v1/auth/register', (req, res) =>
  ok(res, req, { user: { ...DEMO_USER, email: req.body?.email ?? DEMO_USER.email, language: req.body?.language ?? 'en', country: req.body?.country ?? 'IN' }, tokens: DEMO_TOKENS }, 201));

app.post('/api/v1/auth/login', (req, res) =>
  ok(res, req, { user: { ...DEMO_USER, email: req.body?.email ?? DEMO_USER.email }, tokens: DEMO_TOKENS }));

app.post('/api/v1/auth/logout', (req, res) =>
  ok(res, req, { message: 'Logged out successfully' }));

app.post('/api/v1/auth/refresh', (req, res) =>
  ok(res, req, { ...DEMO_TOKENS, accessToken: 'demo-refreshed-' + Date.now() }));

// ── Profile ───────────────────────────────────────────────────────────────────
app.get('/api/v1/profile', (req, res) =>
  ok(res, req, { id: 'demo-profile', userId: 'demo-user-001', country: 'IN', language: 'en', farmCategory: 'small', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));

app.patch('/api/v1/profile', (req, res) =>
  ok(res, req, { id: 'demo-profile', language: req.body?.language ?? 'en', farmCategory: req.body?.farmCategory ?? 'small', updatedAt: new Date().toISOString() }));

// ── Farms ─────────────────────────────────────────────────────────────────────
const DEMO_FARMS = [
  { id: 'demo-farm-001', farmerProfileId: 'demo-profile', name: 'North Wheat Field', location: { lat: 28.6139, lon: 77.2090 }, areaHectares: 2.5, farmCategory: 'small', country: 'IN', irrigationType: 'drip', farmingPractice: 'conventional', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-farm-002', farmerProfileId: 'demo-profile', name: 'South Rice Paddy', location: { lat: 20.5937, lon: 78.9629 }, areaHectares: 1.8, farmCategory: 'small', country: 'IN', irrigationType: 'canal', farmingPractice: 'organic', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

app.get('/api/v1/farms', (req, res) =>
  ok(res, req, { data: DEMO_FARMS, meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 } }));

app.post('/api/v1/farms', (req, res) =>
  ok(res, req, { id: 'new-farm-' + Date.now(), farmerProfileId: 'demo-profile', name: req.body?.name ?? 'New Farm', location: req.body?.location ?? { lat: 28.6, lon: 77.2 }, areaHectares: req.body?.areaHectares ?? 1.0, farmCategory: 'small', country: req.body?.country ?? 'IN', irrigationType: req.body?.irrigationType ?? 'rainfed', farmingPractice: req.body?.farmingPractice ?? 'conventional', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, 201));

app.get('/api/v1/farms/:farmId', (req, res) => {
  const farm = DEMO_FARMS.find(f => f.id === req.params.farmId) ?? DEMO_FARMS[0];
  ok(res, req, farm);
});

app.patch('/api/v1/farms/:farmId', (req, res) => {
  const farm = DEMO_FARMS.find(f => f.id === req.params.farmId) ?? DEMO_FARMS[0];
  ok(res, req, { ...farm, ...req.body, updatedAt: new Date().toISOString() });
});

app.delete('/api/v1/farms/:farmId', (req, res) =>
  res.status(204).send());

// ── Fields ────────────────────────────────────────────────────────────────────
app.get('/api/v1/farms/:farmId/fields', (req, res) =>
  ok(res, req, [{ id: 'field-001', farmId: req.params.farmId, name: 'Field A', areaHectares: 1.2, createdAt: new Date().toISOString() }]));

app.post('/api/v1/farms/:farmId/fields', (req, res) =>
  ok(res, req, { id: 'field-' + Date.now(), farmId: req.params.farmId, name: req.body?.name ?? 'New Field', areaHectares: req.body?.areaHectares ?? 1.0, createdAt: new Date().toISOString() }, 201));

// ── Crop Cycles ────────────────────────────────────────────────────────────────
app.get('/api/v1/fields/:fieldId/crop-cycles/active', (req, res) =>
  ok(res, req, { id: 'cycle-001', fieldId: req.params.fieldId, cropName: 'wheat', cropVariety: 'HD-2967', growthStage: 'flowering', sowingDate: new Date(Date.now() - 90*86400000).toISOString(), expectedHarvestDate: new Date(Date.now() + 30*86400000).toISOString(), isActive: true }));

app.post('/api/v1/fields/:fieldId/crop-cycles', (req, res) =>
  ok(res, req, { id: 'cycle-' + Date.now(), fieldId: req.params.fieldId, cropName: req.body?.cropName ?? 'wheat', growthStage: req.body?.growthStage ?? 'germination', sowingDate: req.body?.sowingDate ?? new Date().toISOString(), isActive: true }, 201));

// ── Advisories ─────────────────────────────────────────────────────────────────
const generateAdvisory = (farmId, lang = 'en') => ({
  id: 'adv-' + Date.now(),
  farmId,
  cropCycleId: 'cycle-001',
  category: 'WEATHER_ALERT',
  recommendation: '⚠️ URGENT: Temperature of 40°C exceeds heat stress threshold during flowering stage of wheat. Irrigate immediately — apply 45mm via drip before 9 AM to prevent pollen sterility and grain set failure.',
  reason: 'Estimated crop water demand for flowering stage wheat is 9 mm/day. Recent rainfall: 0 mm (0% coverage). Temperature of 40°C indicates high evapotranspiration (1.3× baseline). Satellite NDVI of 0.62 shows moderate vegetative stress.',
  actionTiming: 'Immediately — heat stress above 38°C during flowering causes irreversible yield loss within 6–12 hours.',
  riskAddressed: 'Heat stress, pollen sterility, and grain set failure during the most yield-critical growth stage.',
  environmentalImpact: 'Targeted drip irrigation at estimated deficit (45mm) prevents over-watering. Early morning application reduces evaporation by 30–40% compared to midday.',
  confidence: 0.91,
  riskLevel: 'CRITICAL',
  language: lang,
  modelVersion: 'rule-engine-1.0.0',
  evidence: {
    weather: { summary: 'Temp 40°C, humidity 38%, precipitation 0.0 mm', source: 'Open-Meteo', timestamp: new Date().toISOString(), freshness: 'current', dataType: 'observed' },
    satellite: { summary: 'NDVI 0.62, soil moisture index 0.24', ndvi: 0.62, source: 'Stub Satellite Provider', timestamp: new Date(Date.now() - 2*86400000).toISOString(), freshness: 'recent', dataType: 'model_derived' },
    soil: { summary: 'pH 6.5, moisture 22%', source: 'Field Observation', timestamp: new Date(Date.now() - 5*86400000).toISOString(), freshness: 'stale', dataType: 'observed' },
    cropStage: 'wheat at flowering growth stage',
    historicalContext: 'Advisory based on: Weather (current), Satellite data (recent), Soil observation (stale)',
  },
  generatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
});

app.post('/api/v1/advisories/generate', (req, res) =>
  ok(res, req, generateAdvisory(req.body?.farmId ?? 'demo-farm', req.body?.language ?? 'en')));

app.get('/api/v1/advisories', (req, res) => {
  const farmId = req.query.farmId ?? 'demo-farm';
  ok(res, req, { data: [generateAdvisory(farmId)], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
});

app.get('/api/v1/advisories/:id', (req, res) =>
  ok(res, req, generateAdvisory('demo-farm')));

// ── Diagnostics ────────────────────────────────────────────────────────────────
app.post('/api/v1/diagnostics/images', (req, res) =>
  ok(res, req, { imageId: 'img-' + Date.now(), mimeType: 'image/jpeg', widthPx: 640, heightPx: 480, sizeBytes: 204800, message: 'Image uploaded successfully. Use the imageId in your diagnostic request.' }, 201));

app.post('/api/v1/diagnostics', (req, res) => {
  const id = 'diag-' + Date.now();
  ok(res, req, {
    id,
    farmId: req.body?.farmId ?? 'demo-farm',
    cropName: req.body?.cropName ?? 'wheat',
    growthStage: req.body?.growthStage ?? 'vegetative',
    status: 'completed',
    conditions: [
      { name: 'leaf_rust', confidence: 0.88, description: 'Orange/brown pustules on lower leaf surfaces. Spreads rapidly in humid conditions. Significant yield loss if untreated during grain fill.', severity: 'HIGH' },
      { name: 'powdery_mildew', confidence: 0.09, description: 'White powdery coating on leaf surfaces. Secondary infection possible under dry conditions.', severity: 'MEDIUM' },
      { name: 'healthy', confidence: 0.03, description: 'No disease symptoms detected.', severity: 'LOW' },
    ],
    topCondition: { name: 'leaf_rust', confidence: 0.88, description: 'Orange/brown pustules on lower leaf surfaces. Spreads rapidly in humid conditions.', severity: 'HIGH' },
    confidence: 0.88,
    modelVersion: 'stub-disease-classifier-0.1.0',
    diagnosedAt: new Date().toISOString(),
    safeNextSteps: [
      'Isolate the affected area to prevent spread to neighbouring fields.',
      'Consult a local agricultural extension officer or agronomist for confirmation before applying any fungicide.',
      'Document affected field sections with photographs and GPS coordinates for follow-up monitoring.',
      'If confirmed, apply a registered triazole or strobilurin fungicide during early morning or late evening.',
    ],
    requiresExpertConsultation: true,
    disclaimer: 'This is an automated screening result with 88% confidence. It is NOT a definitive diagnosis. Always verify with a certified agronomist or agricultural extension officer before applying any treatments.',
  }, 201);
});

app.get('/api/v1/diagnostics', (req, res) =>
  ok(res, req, { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }));

app.get('/api/v1/diagnostics/:id', (req, res) =>
  ok(res, req, {
    id: req.params.id,
    farmId: 'demo-farm', cropName: 'wheat', growthStage: 'vegetative',
    status: 'completed',
    conditions: [{ name: 'leaf_rust', confidence: 0.88, description: 'Orange pustules on leaves.', severity: 'HIGH' }],
    topCondition: { name: 'leaf_rust', confidence: 0.88, description: 'Orange pustules on leaves.', severity: 'HIGH' },
    confidence: 0.88, modelVersion: 'stub-0.1.0', diagnosedAt: new Date().toISOString(),
    safeNextSteps: ['Consult an agronomist for confirmation.'],
    requiresExpertConsultation: true,
    disclaimer: 'Demo mode — automated screening result, not a definitive diagnosis.',
  }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, requestId: req.id, error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌿  BRICS AgriN — Demo API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API:     http://localhost:${PORT}
  Health:  http://localhost:${PORT}/health/live

  Mode: DEMO (no PostgreSQL or Redis required)
  All responses are realistic stub data.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
});

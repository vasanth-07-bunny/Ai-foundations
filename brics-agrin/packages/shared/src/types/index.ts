/**
 * Shared domain types used by both the API and the web client.
 * These represent the public contract — not internal DB schemas.
 */

import type {
  AdvisoryCategory,
  CropGrowthStage,
  DataFreshness,
  DataType,
  FarmCategory,
  FarmingPractice,
  IrrigationType,
  RiskLevel,
  SupportedCountry,
  SupportedLanguage,
} from '../constants/index.js';

// ─── Geo ────────────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number; // WGS84 decimal degrees
  lon: number; // WGS84 decimal degrees
}

export interface GeoBoundary {
  type: 'Polygon';
  coordinates: number[][][]; // GeoJSON Polygon
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── API Response Envelope ───────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── User / Auth ─────────────────────────────────────────────────────────────

export interface UserPublic {
  id: string;
  email: string;
  role: UserRole;
  language: SupportedLanguage;
  country: SupportedCountry;
  createdAt: string; // ISO 8601
}

export type UserRole = 'farmer' | 'advisor' | 'admin';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

// ─── Farmer Profile ──────────────────────────────────────────────────────────

/**
 * Minimal farmer profile — only data required to deliver the service.
 * No unnecessary PII collected.
 */
export interface FarmerProfile {
  id: string;
  userId: string;
  country: SupportedCountry;
  language: SupportedLanguage;
  farmCategory: FarmCategory;
  createdAt: string;
  updatedAt: string;
}

// ─── Farm ────────────────────────────────────────────────────────────────────

export interface Farm {
  id: string;
  farmerProfileId: string;
  name: string;
  location: GeoPoint;
  areaHectares: number;
  farmCategory: FarmCategory;
  country: SupportedCountry;
  irrigationType: IrrigationType;
  farmingPractice: FarmingPractice;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFarmRequest {
  name: string;
  location: GeoPoint;
  areaHectares: number;
  country: SupportedCountry;
  irrigationType: IrrigationType;
  farmingPractice: FarmingPractice;
}

// ─── Field ───────────────────────────────────────────────────────────────────

export interface Field {
  id: string;
  farmId: string;
  name: string;
  boundary?: GeoBoundary;
  areaHectares: number;
  createdAt: string;
}

// ─── Crop Cycle ──────────────────────────────────────────────────────────────

export interface CropCycle {
  id: string;
  fieldId: string;
  cropName: string;
  cropVariety?: string;
  growthStage: CropGrowthStage;
  sowingDate: string; // ISO 8601 date
  expectedHarvestDate?: string;
  isActive: boolean;
}

// ─── Soil Observation ────────────────────────────────────────────────────────

export interface SoilObservation {
  id: string;
  fieldId: string;
  observedAt: string;
  phLevel?: number;
  organicCarbonPercent?: number;
  nitrogenKgPerHa?: number;
  phosphorusKgPerHa?: number;
  potassiumKgPerHa?: number;
  moisturePercent?: number;
  textureClass?: string; // sandy, loamy, clay, etc.
  source: string;
  dataType: DataType;
}

// ─── Weather Observation ─────────────────────────────────────────────────────

export interface WeatherObservation {
  location: GeoPoint;
  timestamp: string; // ISO 8601
  temperatureCelsius: number;
  humidityPercent: number;
  precipitationMm: number;
  windSpeedMps: number;
  uvIndex?: number;
  dataType: DataType; // observed vs predicted
  source: string;
  freshness: DataFreshness;
}

// ─── Satellite Observation ───────────────────────────────────────────────────

export interface SatelliteObservation {
  location: GeoPoint;
  timestamp: string;
  ndvi?: number;         // Normalized Difference Vegetation Index
  evi?: number;          // Enhanced Vegetation Index
  soilMoistureIndex?: number;
  landSurfaceTemp?: number;
  cloudCoverPercent?: number;
  source: string;
  dataType: DataType;
  freshness: DataFreshness;
}

// ─── Advisory ────────────────────────────────────────────────────────────────

export interface Advisory {
  id: string;
  farmId: string;
  fieldId?: string;
  cropCycleId?: string;
  category: AdvisoryCategory;
  recommendation: string;
  reason: string;
  actionTiming: string;
  riskAddressed: string;
  environmentalImpact: string;
  confidence: number;       // 0–1
  riskLevel: RiskLevel;
  evidence: AdvisoryEvidence;
  modelVersion: string;
  generatedAt: string;
  expiresAt: string;
  language: SupportedLanguage;
}

export interface AdvisoryEvidence {
  weather?: {
    summary: string;
    source: string;
    timestamp: string;
    freshness: DataFreshness;
    dataType: DataType;
  };
  soil?: {
    summary: string;
    source: string;
    timestamp: string;
    freshness: DataFreshness;
    dataType: DataType;
  };
  satellite?: {
    summary: string;
    ndvi?: number;
    source: string;
    timestamp: string;
    freshness: DataFreshness;
    dataType: DataType;
  };
  cropStage?: string;
  historicalContext?: string;
}

// ─── Diagnostic ──────────────────────────────────────────────────────────────

export interface DiagnosticRequest {
  farmId: string;
  fieldId?: string;
  cropName: string;
  growthStage: CropGrowthStage;
  imageId: string; // server-assigned ID after upload
  notes?: string;
}

export interface DiagnosticResult {
  id: string;
  farmId: string;
  cropName: string;
  growthStage: CropGrowthStage;
  status: DiagnosticStatus;
  conditions: DiagnosticCondition[];
  topCondition?: DiagnosticCondition;
  confidence: number;
  modelVersion: string;
  diagnosedAt: string;
  safeNextSteps: string[];
  requiresExpertConsultation: boolean;
  disclaimer: string;
}

export type DiagnosticStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'low_confidence'
  | 'inconclusive';

export interface DiagnosticCondition {
  name: string;
  confidence: number; // 0–1
  description: string;
  severity: RiskLevel;
  dataType: 'model_derived';
}

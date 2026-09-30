/**
 * Zod validation schemas shared between API (server-side validation)
 * and web (client-side form validation).
 */

import { z } from 'zod';
import {
  CROP_GROWTH_STAGES,
  FARMING_PRACTICES,
  IRRIGATION_TYPES,
  SUPPORTED_COUNTRIES,
  SUPPORTED_LANGUAGES,
  FARM_CATEGORIES,
} from '../constants/index.js';

// ─── Geo ─────────────────────────────────────────────────────────────────────

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const GeoBoundarySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

// ─── Pagination ──────────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain uppercase, lowercase, digit, and special character',
    ),
  language: z.enum(SUPPORTED_LANGUAGES),
  country: z.enum(SUPPORTED_COUNTRIES),
});

export const LoginSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(1).max(128),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Farm ────────────────────────────────────────────────────────────────────

export const CreateFarmSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  location: GeoPointSchema,
  areaHectares: z.number().positive().max(100_000),
  country: z.enum(SUPPORTED_COUNTRIES),
  irrigationType: z.enum(IRRIGATION_TYPES),
  farmingPractice: z.enum(FARMING_PRACTICES),
});

export const UpdateFarmSchema = CreateFarmSchema.partial();

// ─── Field ───────────────────────────────────────────────────────────────────

export const CreateFieldSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  boundary: GeoBoundarySchema.optional(),
  areaHectares: z.number().positive().max(50_000),
});

// ─── Crop Cycle ──────────────────────────────────────────────────────────────

export const CreateCropCycleSchema = z.object({
  cropName: z.string().min(1).max(100).trim(),
  cropVariety: z.string().max(100).trim().optional(),
  growthStage: z.enum(CROP_GROWTH_STAGES),
  sowingDate: z.string().datetime({ offset: true }),
  expectedHarvestDate: z.string().datetime({ offset: true }).optional(),
});

export const UpdateCropStageSchema = z.object({
  growthStage: z.enum(CROP_GROWTH_STAGES),
});

// ─── Advisory ────────────────────────────────────────────────────────────────

export const AdvisoryRequestSchema = z.object({
  farmId: z.string().uuid(),
  fieldId: z.string().uuid().optional(),
  cropCycleId: z.string().uuid().optional(),
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),
});

// ─── Diagnostic ──────────────────────────────────────────────────────────────

export const DiagnosticRequestSchema = z.object({
  farmId: z.string().uuid(),
  fieldId: z.string().uuid().optional(),
  cropName: z.string().min(1).max(100).trim(),
  growthStage: z.enum(CROP_GROWTH_STAGES),
  imageId: z.string().uuid(),
  notes: z.string().max(1000).trim().optional(),
});

// ─── Farmer Profile ──────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  farmCategory: z.enum(FARM_CATEGORIES).optional(),
});

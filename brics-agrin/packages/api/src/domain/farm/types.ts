/**
 * Internal domain types for Farm context.
 * These map to DB rows but are decoupled from Prisma's generated types
 * so the service layer doesn't import ORM types directly.
 */

import type { FarmingPractice, IrrigationType } from '@prisma/client';
import type { GeoPoint } from '@brics-agrin/shared';

export interface FarmRecord {
  id: string;
  farmerProfileId: string;
  name: string;
  location: GeoPoint;
  areaHectares: number;
  country: string;
  irrigationType: IrrigationType;
  farmingPractice: FarmingPractice;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldRecord {
  id: string;
  farmId: string;
  name: string;
  areaHectares: number;
  boundaryJson: unknown | null;
  createdAt: Date;
}

export interface CropCycleRecord {
  id: string;
  fieldId: string;
  cropName: string;
  cropVariety: string | null;
  growthStage: string;
  sowingDate: Date;
  expectedHarvestDate: Date | null;
  isActive: boolean;
}

export interface CreateFarmInput {
  farmerProfileId: string;
  name: string;
  location: GeoPoint;
  areaHectares: number;
  country: string;
  irrigationType: IrrigationType;
  farmingPractice: FarmingPractice;
}

export interface CreateFieldInput {
  farmId: string;
  name: string;
  areaHectares: number;
  boundaryJson?: unknown;
}

export interface CreateCropCycleInput {
  fieldId: string;
  cropName: string;
  cropVariety?: string;
  growthStage: string;
  sowingDate: Date;
  expectedHarvestDate?: Date;
}

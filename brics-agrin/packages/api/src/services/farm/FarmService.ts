/**
 * Farm Service — CRUD for farms, fields, and crop cycles.
 *
 * Authorization: Every mutation verifies the requesting user owns the resource.
 * Soft-delete: farms and fields use deleted_at — records are recoverable.
 */

import { prisma } from '../../db/client.js';
import { NotFoundError, AuthorizationError } from '../../utils/errors.js';
import { toPrismaSkipTake, paginate } from '../../utils/pagination.js';
import type { Farm, Field, CropCycle, PaginatedResponse } from '@brics-agrin/shared';
import type { PaginationInput } from '../../utils/pagination.js';
import type { CreateFarmInput, CreateFieldInput, CreateCropCycleInput } from '../../domain/farm/types.js';

export class FarmService {
  // ── Farms ──────────────────────────────────────────────────────────────────

  async createFarm(input: CreateFarmInput, userId: string): Promise<Farm> {
    const profile = await this.getProfileOrThrow(userId);

    const record = await prisma.farm.create({
      data: {
        farmerProfileId: profile.id,
        name: input.name,
        locationLat: input.location.lat,
        locationLon: input.location.lon,
        areaHectares: input.areaHectares,
        farmCategory: this.deriveFarmCategory(input.areaHectares),
        country: input.country,
        irrigationType: input.irrigationType.toUpperCase() as never,
        farmingPractice: input.farmingPractice.toUpperCase() as never,
      },
    });

    return this.toFarmDto(record);
  }

  async listFarms(
    userId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<Farm>> {
    const profile = await this.getProfileOrThrow(userId);
    const { skip, take } = toPrismaSkipTake(pagination);

    const [records, total] = await Promise.all([
      prisma.farm.findMany({
        where: { farmerProfileId: profile.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.farm.count({ where: { farmerProfileId: profile.id, deletedAt: null } }),
    ]);

    return paginate(records.map((r) => this.toFarmDto(r)), total, pagination);
  }

  async getFarm(farmId: string, userId: string): Promise<Farm> {
    const record = await prisma.farm.findFirst({
      where: { id: farmId, deletedAt: null, farmerProfile: { userId } },
    });
    if (!record) throw new NotFoundError('Farm', farmId);
    return this.toFarmDto(record);
  }

  async updateFarm(
    farmId: string,
    userId: string,
    data: Partial<CreateFarmInput>,
  ): Promise<Farm> {
    await this.assertFarmOwnership(farmId, userId);

    const updated = await prisma.farm.update({
      where: { id: farmId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.location ? { locationLat: data.location.lat, locationLon: data.location.lon } : {}),
        ...(data.areaHectares !== undefined ? { areaHectares: data.areaHectares, farmCategory: this.deriveFarmCategory(data.areaHectares) } : {}),
        ...(data.irrigationType ? { irrigationType: data.irrigationType.toUpperCase() as never } : {}),
        ...(data.farmingPractice ? { farmingPractice: data.farmingPractice.toUpperCase() as never } : {}),
      },
    });

    return this.toFarmDto(updated);
  }

  async deleteFarm(farmId: string, userId: string): Promise<void> {
    await this.assertFarmOwnership(farmId, userId);
    await prisma.farm.update({
      where: { id: farmId },
      data: { deletedAt: new Date() },
    });
  }

  // ── Fields ─────────────────────────────────────────────────────────────────

  async createField(
    farmId: string,
    userId: string,
    input: Omit<CreateFieldInput, 'farmId'>,
  ): Promise<Field> {
    await this.assertFarmOwnership(farmId, userId);

    const record = await prisma.field.create({
      data: {
        farmId,
        name: input.name,
        areaHectares: input.areaHectares,
        boundaryJson: input.boundaryJson ? input.boundaryJson as never : undefined,
      },
    });

    return this.toFieldDto(record);
  }

  async listFields(farmId: string, userId: string): Promise<Field[]> {
    await this.assertFarmOwnership(farmId, userId);

    const records = await prisma.field.findMany({
      where: { farmId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r) => this.toFieldDto(r));
  }

  // ── Crop Cycles ────────────────────────────────────────────────────────────

  async createCropCycle(
    fieldId: string,
    userId: string,
    input: Omit<CreateCropCycleInput, 'fieldId'>,
  ): Promise<CropCycle> {
    await this.assertFieldOwnership(fieldId, userId);

    // Deactivate any existing active crop cycle for this field
    await prisma.cropCycle.updateMany({
      where: { fieldId, isActive: true },
      data: { isActive: false },
    });

    const record = await prisma.cropCycle.create({
      data: {
        fieldId,
        cropName: input.cropName,
        cropVariety: input.cropVariety ?? null,
        growthStage: input.growthStage.toUpperCase() as never,
        sowingDate: input.sowingDate,
        expectedHarvestDate: input.expectedHarvestDate ?? null,
        isActive: true,
      },
    });

    return this.toCropCycleDto(record);
  }

  async getActiveCropCycle(fieldId: string, userId: string): Promise<CropCycle | null> {
    await this.assertFieldOwnership(fieldId, userId);

    const record = await prisma.cropCycle.findFirst({
      where: { fieldId, isActive: true },
    });

    return record ? this.toCropCycleDto(record) : null;
  }

  async updateCropStage(
    cropCycleId: string,
    userId: string,
    growthStage: string,
  ): Promise<CropCycle> {
    const record = await prisma.cropCycle.findUnique({ where: { id: cropCycleId } });
    if (!record) throw new NotFoundError('CropCycle', cropCycleId);

    await this.assertFieldOwnership(record.fieldId, userId);

    const updated = await prisma.cropCycle.update({
      where: { id: cropCycleId },
      data: { growthStage: growthStage.toUpperCase() as never },
    });

    return this.toCropCycleDto(updated);
  }

  // ── Authorization helpers ──────────────────────────────────────────────────

  async assertFarmOwnership(farmId: string, userId: string): Promise<void> {
    const farm = await prisma.farm.findFirst({
      where: { id: farmId, deletedAt: null, farmerProfile: { userId } },
      select: { id: true },
    });
    if (!farm) throw new AuthorizationError('Farm not found or access denied');
  }

  private async assertFieldOwnership(fieldId: string, userId: string): Promise<void> {
    const field = await prisma.field.findFirst({
      where: { id: fieldId, deletedAt: null, farm: { farmerProfile: { userId } } },
      select: { id: true },
    });
    if (!field) throw new AuthorizationError('Field not found or access denied');
  }

  private async getProfileOrThrow(userId: string) {
    const profile = await prisma.farmerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('FarmerProfile');
    return profile;
  }

  // ── DTO mappers ────────────────────────────────────────────────────────────

  private toFarmDto(r: {
    id: string; farmerProfileId: string; name: string;
    locationLat: unknown; locationLon: unknown;
    areaHectares: unknown; farmCategory: string;
    country: string; irrigationType: string; farmingPractice: string;
    createdAt: Date; updatedAt: Date;
  }): Farm {
    return {
      id: r.id,
      farmerProfileId: r.farmerProfileId,
      name: r.name,
      location: { lat: Number(r.locationLat), lon: Number(r.locationLon) },
      areaHectares: Number(r.areaHectares),
      farmCategory: r.farmCategory.toLowerCase() as Farm['farmCategory'],
      country: r.country as Farm['country'],
      irrigationType: r.irrigationType.toLowerCase() as Farm['irrigationType'],
      farmingPractice: r.farmingPractice.toLowerCase() as Farm['farmingPractice'],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toFieldDto(r: {
    id: string; farmId: string; name: string;
    areaHectares: unknown; boundaryJson: unknown; createdAt: Date;
  }): Field {
    return {
      id: r.id,
      farmId: r.farmId,
      name: r.name,
      areaHectares: Number(r.areaHectares),
      boundary: r.boundaryJson as Field['boundary'],
      createdAt: r.createdAt.toISOString(),
    };
  }

  private toCropCycleDto(r: {
    id: string; fieldId: string; cropName: string;
    cropVariety: string | null; growthStage: string;
    sowingDate: Date; expectedHarvestDate: Date | null; isActive: boolean;
  }): CropCycle {
    return {
      id: r.id,
      fieldId: r.fieldId,
      cropName: r.cropName,
      cropVariety: r.cropVariety ?? undefined,
      growthStage: r.growthStage.toLowerCase() as CropCycle['growthStage'],
      sowingDate: r.sowingDate.toISOString(),
      expectedHarvestDate: r.expectedHarvestDate?.toISOString(),
      isActive: r.isActive,
    };
  }

  private deriveFarmCategory(hectares: number): string {
    if (hectares < 1) return 'MARGINAL';
    if (hectares <= 2) return 'SMALL';
    if (hectares <= 4) return 'SEMI_MEDIUM';
    if (hectares <= 10) return 'MEDIUM';
    return 'LARGE';
  }
}

export const farmService = new FarmService();

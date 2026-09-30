/**
 * Soil data provider backed by the local database.
 *
 * Soil observations are entered via:
 *   1. Government agricultural extension officers importing lab test data
 *   2. Automated IoT sensors writing via the soil ingestion API
 *   3. Manual entry by farmers / advisors
 *
 * Falls back to returning null when no recent observation exists.
 * The advisory engine handles the null case gracefully.
 */

import type { SoilDataProvider } from '../interfaces.js';
import type { SoilObservation } from '@brics-agrin/shared';
import { prisma } from '../../db/client.js';
import { createLogger } from '../../observability/logger.js';
import { classifyFreshness } from '../../utils/dataFreshness.js';

const log = createLogger('soil:database');

// Maximum age of a soil observation to be considered usable (30 days)
const MAX_SOIL_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export class DatabaseSoilProvider implements SoilDataProvider {
  readonly providerKey = 'database-soil';
  readonly displayName = 'On-Platform Soil Observation Database';

  async getLatestObservation(fieldId: string): Promise<SoilObservation | null> {
    try {
      const record = await prisma.soilObservation.findFirst({
        where: {
          fieldId,
          observedAt: {
            gte: new Date(Date.now() - MAX_SOIL_AGE_MS),
          },
        },
        orderBy: { observedAt: 'desc' },
      });

      if (!record) {
        log.debug({ fieldId }, 'No recent soil observation found');
        return null;
      }

      const observation: SoilObservation = {
        id: record.id,
        fieldId: record.fieldId,
        observedAt: record.observedAt.toISOString(),
        phLevel: record.phLevel ? Number(record.phLevel) : undefined,
        organicCarbonPercent: record.organicCarbonPercent
          ? Number(record.organicCarbonPercent)
          : undefined,
        nitrogenKgPerHa: record.nitrogenKgPerHa
          ? Number(record.nitrogenKgPerHa)
          : undefined,
        phosphorusKgPerHa: record.phosphorusKgPerHa
          ? Number(record.phosphorusKgPerHa)
          : undefined,
        potassiumKgPerHa: record.potassiumKgPerHa
          ? Number(record.potassiumKgPerHa)
          : undefined,
        moisturePercent: record.moisturePercent
          ? Number(record.moisturePercent)
          : undefined,
        textureClass: record.textureClass ?? undefined,
        source: record.source,
        dataType: record.dataType.toLowerCase() as SoilObservation['dataType'],
      };

      return observation;
    } catch (err) {
      log.error({ err, fieldId }, 'Soil observation DB query failed');
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

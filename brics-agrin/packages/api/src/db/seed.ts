/**
 * Database seed — inserts reference / configuration data.
 * Only run in development and test environments.
 * Never inserts real farmer data.
 */

import { prisma } from './client.js';

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Seed model versions
  await prisma.modelVersion.upsert({
    where: { modelId_version: { modelId: 'advisory-engine', version: '1.0.0' } },
    create: {
      modelId: 'advisory-engine',
      modelType: 'advisory',
      version: '1.0.0',
      description: 'Rule-based + AI advisory engine v1',
      isActive: true,
      deployedAt: new Date(),
    },
    update: {},
  });

  await prisma.modelVersion.upsert({
    where: { modelId_version: { modelId: 'disease-classifier', version: '1.0.0' } },
    create: {
      modelId: 'disease-classifier',
      modelType: 'diagnostic',
      version: '1.0.0',
      description: 'Crop disease image classifier v1 (stub)',
      isActive: true,
      deployedAt: new Date(),
    },
    update: {},
  });

  // Seed data sources for India
  await prisma.agriculturalDataSource.upsert({
    where: {
      country_providerType_providerKey: {
        country: 'IN',
        providerType: 'WEATHER',
        providerKey: 'open-meteo',
      },
    },
    create: {
      country: 'IN',
      providerType: 'WEATHER',
      providerKey: 'open-meteo',
      displayName: 'Open-Meteo Weather API',
      isActive: true,
      priority: 1,
    },
    update: {},
  });

  await prisma.agriculturalDataSource.upsert({
    where: {
      country_providerType_providerKey: {
        country: 'BR',
        providerType: 'WEATHER',
        providerKey: 'open-meteo',
      },
    },
    create: {
      country: 'BR',
      providerType: 'WEATHER',
      providerKey: 'open-meteo',
      displayName: 'Open-Meteo Weather API',
      isActive: true,
      priority: 1,
    },
    update: {},
  });

  console.log('Seed complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

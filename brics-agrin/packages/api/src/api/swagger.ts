/**
 * OpenAPI 3.0 documentation setup.
 * Only mounted in non-production environments.
 */

import type { Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BRICS AgriN API',
      version: '1.0.0',
      description:
        'AI-powered digital agriculture advisory network for small and marginal farmers.',
      contact: {
        name: 'BRICS AgriN',
      },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication and token management' },
      { name: 'Profile', description: 'Farmer profile management' },
      { name: 'Farms', description: 'Farm CRUD operations' },
      { name: 'Fields', description: 'Field management within a farm' },
      { name: 'CropCycles', description: 'Active crop cycle tracking' },
      { name: 'Advisories', description: 'AI-powered agro-advisory engine' },
      { name: 'Diagnostics', description: 'Crop disease diagnostic pipeline' },
    ],
  },
  apis: ['./src/api/v1/routes/*.ts', './src/api/v1/controllers/*.ts'],
};

export function setupSwagger(app: Application): void {
  const spec = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, {
    customSiteTitle: 'BRICS AgriN API Docs',
  }));
}

/**
 * API v1 router — aggregates all v1 sub-routers.
 * Versioning is handled at this layer so /api/v2 can coexist later.
 */

import { Router } from 'express';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { farmRouter } from './routes/farms.js';
import { fieldRouter } from './routes/fields.js';
import { cropCycleRouter } from './routes/cropCycles.js';
import { advisoryRouter } from './routes/advisories.js';
import { diagnosticRouter } from './routes/diagnostics.js';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/profile', profileRouter);
v1Router.use('/farms', farmRouter);
v1Router.use('/farms/:farmId/fields', fieldRouter);
v1Router.use('/fields/:fieldId/crop-cycles', cropCycleRouter);
v1Router.use('/advisories', advisoryRouter);
v1Router.use('/diagnostics', diagnosticRouter);

/**
 * Remote satellite provider template.
 *
 * Implements SatelliteProvider against a configurable remote API endpoint.
 * Set SATELLITE_BASE_URL and SATELLITE_API_KEY in environment to activate.
 *
 * Expected remote API contract (adapt to actual provider):
 * GET /ndvi?lat={lat}&lon={lon}
 * Response: { ndvi, evi, soilMoistureIndex, landSurfaceTemp, cloudCoverPercent, timestamp }
 */

import type { SatelliteProvider } from '../interfaces.js';
import type { GeoPoint, SatelliteObservation } from '@brics-agrin/shared';
import { httpGet } from '../../utils/httpClient.js';
import { createLogger } from '../../observability/logger.js';
import { classifyFreshness } from '../../utils/dataFreshness.js';
import { metrics } from '../../observability/metrics.js';
import { config } from '../../config/index.js';

const log = createLogger('satellite:remote');

interface RemoteSatelliteResponse {
  ndvi?: number;
  evi?: number;
  soil_moisture_index?: number;
  land_surface_temp_celsius?: number;
  cloud_cover_percent?: number;
  acquisition_time: string;
}

export class RemoteSatelliteProvider implements SatelliteProvider {
  readonly providerKey = 'remote-satellite';
  readonly displayName = 'Remote Satellite Data Provider';

  async getLatestObservation(location: GeoPoint): Promise<SatelliteObservation | null> {
    if (!config.SATELLITE_BASE_URL || !config.SATELLITE_API_KEY) {
      log.warn('Remote satellite provider not configured — SATELLITE_BASE_URL/KEY missing');
      return null;
    }

    const start = Date.now();
    try {
      const data = await httpGet<RemoteSatelliteResponse>(
        this.providerKey,
        `${config.SATELLITE_BASE_URL}/ndvi`,
        { lat: location.lat, lon: location.lon },
        {
          headers: { 'X-API-Key': config.SATELLITE_API_KEY },
        },
      );

      metrics.satelliteProviderLatency.observe(Date.now() - start);

      const acquisitionTime = new Date(data.acquisition_time);

      return {
        location,
        timestamp: acquisitionTime.toISOString(),
        ndvi: data.ndvi,
        evi: data.evi,
        soilMoistureIndex: data.soil_moisture_index,
        landSurfaceTemp: data.land_surface_temp_celsius,
        cloudCoverPercent: data.cloud_cover_percent,
        source: this.displayName,
        dataType: 'model_derived',
        freshness: classifyFreshness(acquisitionTime),
      };
    } catch (err) {
      metrics.externalProviderError.increment({ provider: this.providerKey });
      log.warn({ err, location }, 'Remote satellite fetch failed — returning null');
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    return Boolean(config.SATELLITE_BASE_URL && config.SATELLITE_API_KEY);
  }
}

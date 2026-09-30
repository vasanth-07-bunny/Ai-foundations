/**
 * Stub satellite provider.
 *
 * Real satellite data (e.g. NDVI from Sentinel-2 / Landsat via
 * Copernicus/ISRO/INPE APIs) would be integrated here as a concrete
 * SatelliteProvider implementation. The stub allows the rest of the
 * system to function and be tested without that integration.
 *
 * The interface is designed so a real provider can be dropped in
 * without changing any consuming code.
 */

import type { SatelliteProvider } from '../interfaces.js';
import type { GeoPoint, SatelliteObservation } from '@brics-agrin/shared';

export class StubSatelliteProvider implements SatelliteProvider {
  readonly providerKey = 'stub-satellite';
  readonly displayName = 'Stub Satellite Provider (Test/Fallback)';

  async getLatestObservation(location: GeoPoint): Promise<SatelliteObservation> {
    // Deterministic NDVI value — green/healthy range [0.4, 0.8]
    const seed = Math.abs((location.lat * 13.7 + location.lon * 7.3) % 1);
    const ndvi = 0.4 + seed * 0.4;

    return {
      location,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      ndvi: parseFloat(ndvi.toFixed(3)),
      evi: parseFloat((ndvi * 0.85).toFixed(3)),
      soilMoistureIndex: parseFloat((0.3 + seed * 0.4).toFixed(3)),
      landSurfaceTemp: 28 + (seed * 10),
      cloudCoverPercent: seed * 30,
      source: this.displayName,
      dataType: 'model_derived',
      freshness: 'recent',
    };
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

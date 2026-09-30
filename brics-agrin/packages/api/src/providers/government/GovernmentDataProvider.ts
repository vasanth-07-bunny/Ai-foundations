/**
 * Government / BRICS Network Data Provider Interface.
 *
 * BRICS nations may share agricultural data through bilateral or
 * multilateral data-sharing agreements. This interface defines
 * the contract that any government or BRICS-network integration
 * must implement to plug into the platform.
 *
 * Example integrations (future):
 *   - India: PM-KISAN crop insurance database
 *   - Brazil: EMBRAPA soil research data
 *   - China: National Agricultural Remote Sensing data
 *   - Russia: Roshydromet weather data
 *   - South Africa: SAWS agricultural meteorological data
 *
 * All providers must:
 *   - Return null (never throw) when data is unavailable
 *   - Label data with its source and data type
 *   - Respect data minimization — return only what the advisory needs
 */

export interface GovernmentCropAdvisory {
  cropName: string;
  country: string;
  season: string;
  advisoryText: string;
  source: string;
  publishedAt: string;
}

export interface GovernmentDataProvider {
  readonly providerKey: string;
  readonly country: string;

  /**
   * Fetch government-issued crop advisories for a crop in a region.
   * Returns empty array if none available.
   */
  getCropAdvisories(
    cropName: string,
    regionCode: string,
  ): Promise<GovernmentCropAdvisory[]>;

  isHealthy(): Promise<boolean>;
}

/**
 * Stub government data provider — returns empty results.
 * Replace with real country integrations as they are built.
 */
export class StubGovernmentDataProvider implements GovernmentDataProvider {
  readonly providerKey: string;
  readonly country: string;

  constructor(country: string) {
    this.providerKey = `stub-govt-${country.toLowerCase()}`;
    this.country = country;
  }

  async getCropAdvisories(
    _cropName: string,
    _regionCode: string,
  ): Promise<GovernmentCropAdvisory[]> {
    return [];
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

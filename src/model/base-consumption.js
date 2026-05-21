import { Asset } from './asset.js';
import { Season } from './season.js';

/**
 * Always-on household base load (lights, appliances, etc.).
 * Performs a bounded random walk around a base load value,
 * with optional time-of-day and seasonal modulation (FR-W8).
 */
export class BaseConsumption extends Asset {
  /**
   * @param {string} name
   * @param {number} baseLoad_kW
   * @param {number} variance_kW
   * @param {boolean} enableModulation — whether to apply time/season modulation
   * @param {number} seasonalVariation — max modulation fraction (e.g. 0.2 = ±20%)
   */
  constructor(name, baseLoad_kW, variance_kW, enableModulation = true, seasonalVariation = 0.2) {
    super(name);
    this.baseLoad_kW = baseLoad_kW;
    this.variance_kW = variance_kW;
    this.enableModulation = enableModulation;
    this.seasonalVariation = seasonalVariation;
    this.currentPower_kW = baseLoad_kW;
  }

  /**
   * @param {number} _deltaTimeHours
   * @param {import('./weather-condition.js').WeatherCondition} weather
   * @param {() => number} rng
   */
  step(_deltaTimeHours, weather, rng) {
    // Random walk: move up or down by up to 20% of variance
    const change = (rng() - 0.5) * 2 * this.variance_kW * 0.2;
    let newPower = this.currentPower_kW + change;

    // Apply time-of-day and seasonal modulation if enabled (FR-W8)
    let modulation = 1.0;
    if (this.enableModulation && weather) {
      const hour = weather.timestamp.getHours();
      const season = weather.season;

      // Evening bump (18-22h): up to +20%
      if (hour >= 18 && hour < 22) {
        modulation += this.seasonalVariation;
      }
      // Night dip (0-6h): down to -20%
      if (hour >= 0 && hour < 6) {
        modulation -= this.seasonalVariation;
      }
      // Winter bump
      if (season === Season.WINTER) {
        modulation += this.seasonalVariation * 0.5;
      }
    }

    const effectiveBase = this.baseLoad_kW * modulation;
    const effectiveVariance = this.variance_kW * modulation;

    // Clamp within effective base ± effective variance
    newPower = Math.max(effectiveBase - effectiveVariance,
      Math.min(effectiveBase + effectiveVariance, newPower));
    this.currentPower_kW = newPower;
  }
}

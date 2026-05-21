import { Asset } from './asset.js';

/**
 * Heat pump — consumes power for heating/cooling.
 * Activity level varies by season (more in winter, less in summer).
 */
export class HeatPump extends Asset {
  constructor(name, maxPower_kW) {
    super(name);
    this.maxPower_kW = maxPower_kW;
  }

  /**
   * @param {number} deltaTimeHours
   * @param {() => number} rng
   * @param {{ month: number }} [seasonContext] — injected by engine for season-aware behaviour
   */
  step(_deltaTimeHours, rng, seasonContext) {
    const month = seasonContext ? seasonContext.month : 6;
    // Seasonal factor: higher in cold months (1.0 in Jan, ~0.15 in Jul)
    // Simple triangle: distance from month 7 (July)
    const coldDist = Math.abs(month - 7);
    const seasonFactor = 0.15 + 0.85 * (coldDist / 6);

    // Random activity level, scaled by season
    const activity = rng() * seasonFactor;
    const power = activity * this.maxPower_kW;
    this.currentPower_kW = Math.round(power * 100) / 100;
  }
}
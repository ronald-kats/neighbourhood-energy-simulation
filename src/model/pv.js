import { Asset } from './asset.js';

/**
 * Solar PV — generates power (negative consumption).
 * Output varies by time of day (daylight hours produce more) and season.
 */
export class PV extends Asset {
  constructor(name, peakPower_kW) {
    super(name);
    this.peakPower_kW = peakPower_kW;
  }

  /**
   * @param {number} deltaTimeHours
   * @param {() => number} rng
   * @param {{ month: number, hour: number }} [context]
   */
  step(_deltaTimeHours, rng, context) {
    const month = context ? context.month : 6;
    const hour = context ? context.hour : 12;

    // Daylight factor: simple model, sun up 6–18 with peak at 12
    let daylightFactor = 0;
    if (hour >= 6 && hour <= 18) {
      // Sine curve peaking at noon
      daylightFactor = Math.sin(((hour - 6) / 12) * Math.PI);
    }

    // Seasonal factor: more sun in summer (month 6–7), less in winter
    const seasonalSun = 0.4 + 0.6 * Math.sin(((month - 3) / 12) * Math.PI);

    // Cloud cover randomness (clear = 1, overcast ≈ 0.2)
    const cloudFactor = 0.2 + rng() * 0.8;

    const power = -(this.peakPower_kW * daylightFactor * seasonalSun * cloudFactor) || 0;
    this.currentPower_kW = Math.round(power * 100) / 100;
  }
}
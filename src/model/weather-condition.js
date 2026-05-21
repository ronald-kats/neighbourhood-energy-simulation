import { Season } from './season.js';

/**
 * Immutable value object representing weather conditions at a point in time.
 */
export class WeatherCondition {
  /**
   * @param {object} params
   * @param {number} params.temperature_C — ambient air temperature
   * @param {number} params.irradianceFactor — normalised irradiance [0, 1]
   * @param {number} params.cloudCover — cloud cover fraction [0, 1]
   * @param {Season} params.season — current season
   * @param {Date} params.timestamp — simulation time
   */
  constructor({ temperature_C, irradianceFactor, cloudCover, season, timestamp }) {
    this.temperature_C = temperature_C;
    this.irradianceFactor = irradianceFactor;
    this.cloudCover = cloudCover;
    this.season = season;
    this.timestamp = timestamp;
  }

  /** Derive season from a Date object. */
  static seasonFromDate(date) {
    return Season.fromMonth(date.getMonth() + 1);
  }
}

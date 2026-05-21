import { Asset } from './asset.js';

/**
 * Solar PV — generates power (negative consumption).
 * Output is driven entirely by weather.irradianceFactor.
 */
export class PV extends Asset {
  constructor(name, peakPower_kW) {
    super(name);
    this.peakPower_kW = peakPower_kW;
  }

  /**
   * @param {number} deltaTimeHours
   * @param {import('./weather-condition.js').WeatherCondition} weather
   * @param {() => number} rng
   */
  step(_deltaTimeHours, weather, _rng) {
    // FR-W6.1: pvPower = peakPower * irradianceFactor
    const power = -(this.peakPower_kW * weather.irradianceFactor);
    this.currentPower_kW = Math.round(power * 100) / 100 || 0;
  }
}

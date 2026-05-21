import { Asset } from './asset.js';

/**
 * Heat pump — consumes power for space heating.
 * Physics-based model driven by outdoor temperature (FR-W7).
 */
export class HeatPump extends Asset {
  /**
   * @param {string} name
   * @param {number} maxPower_kW — maximum electrical power draw
   * @param {number} indoorTargetTemp — target indoor temperature (°C)
   * @param {number} thermalLossCoefficient — building heat loss rate (kW/K)
   * @param {number} cop — coefficient of performance
   */
  constructor(name, maxPower_kW, indoorTargetTemp, thermalLossCoefficient, cop) {
    super(name);
    this.maxPower_kW = maxPower_kW;
    this.indoorTargetTemp = indoorTargetTemp;
    this.thermalLossCoefficient = thermalLossCoefficient;
    this.cop = cop;
  }

  /**
   * FR-W7.1: heatingDemand = max(0, T_indoor - T_outdoor)
   *          hpPower = min(heatingDemand * thermalLossCoefficient / cop, maxPower_kW)
   * @param {number} _deltaTimeHours
   * @param {import('./weather-condition.js').WeatherCondition} weather
   * @param {() => number} _rng
   */
  step(_deltaTimeHours, weather, _rng) {
    const T_outdoor = weather.temperature_C;
    const heatingDemand = Math.max(0, this.indoorTargetTemp - T_outdoor);
    const power = Math.min(
      (heatingDemand * this.thermalLossCoefficient) / this.cop,
      this.maxPower_kW
    );
    this.currentPower_kW = Math.round(power * 100) / 100;
  }
}

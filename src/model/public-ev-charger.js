import { Asset } from './asset.js';

/**
 * Public EV charger — independent random charging sessions.
 * Higher power and more frequent sessions than home chargers.
 */
export class PublicEvCharger extends Asset {
  constructor(name, chargePower_kW, sessionsPerDay, avgSessionDurationHours) {
    super(name);
    this.chargePower_kW = chargePower_kW;
    this.sessionsPerDay = sessionsPerDay;
    this.avgSessionDurationHours = avgSessionDurationHours;
    this._sessionRemainingHours = 0;
  }

  /**
   * @param {number} deltaTimeHours
   * @param {import('./weather-condition.js').WeatherCondition} _weather
   * @param {() => number} rng
   */
  step(deltaTimeHours, _weather, rng) {
    if (this._sessionRemainingHours > 0) {
      this._sessionRemainingHours -= deltaTimeHours;
      this.currentPower_kW = this._sessionRemainingHours > 0 ? this.chargePower_kW : 0;
    } else {
      this.currentPower_kW = 0;
      const sessionsPerHour = this.sessionsPerDay / 24;
      const probStart = sessionsPerHour * deltaTimeHours;
      if (rng() < probStart) {
        this._sessionRemainingHours = this.avgSessionDurationHours * (0.5 + rng());
        this.currentPower_kW = this.chargePower_kW;
      }
    }
  }
}
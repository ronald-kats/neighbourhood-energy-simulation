import { Asset } from './asset.js';

/**
 * Home EV charger — starts random charging sessions.
 * When active, draws constant charge power.
 */
export class HomeEvCharger extends Asset {
  constructor(name, chargePower_kW, sessionsPerDay, avgSessionDurationHours) {
    super(name);
    this.chargePower_kW = chargePower_kW;
    this.sessionsPerDay = sessionsPerDay;
    this.avgSessionDurationHours = avgSessionDurationHours;
    this._sessionRemainingHours = 0;
  }

  /**
   * @param {number} deltaTimeHours
   * @param {() => number} rng
   */
  step(deltaTimeHours, rng) {
    if (this._sessionRemainingHours > 0) {
      // Active session — continue charging
      this._sessionRemainingHours -= deltaTimeHours;
      this.currentPower_kW = this._sessionRemainingHours > 0 ? this.chargePower_kW : 0;
    } else {
      this.currentPower_kW = 0;
      // Chance to start a new session this step
      // Probability = expected sessions per step
      const sessionsPerHour = this.sessionsPerDay / 24;
      const probStart = sessionsPerHour * deltaTimeHours;
      if (rng() < probStart) {
        this._sessionRemainingHours = this.avgSessionDurationHours * (0.5 + rng());
        this.currentPower_kW = this.chargePower_kW;
      }
    }
  }
}
import { House } from './house.js';
import { PublicEvCharger } from './public-ev-charger.js';
import { Battery } from './battery.js';
import { PeakShavingController } from './peak-shaving-controller.js';

/**
 * The neighbourhood: all houses + public EV chargers + optional peak-shaving battery.
 * Tracks aggregate power and a rolling 24-hour history.
 */
export class Neighbourhood {
  constructor(config) {
    this.houses = [];
    for (let i = 1; i <= config.houses.count; i++) {
      this.houses.push(new House(i, config.houses, config.weather));
    }

    const pc = config.publicChargers;
    this.publicChargers = [];
    for (let i = 1; i <= pc.count; i++) {
      this.publicChargers.push(new PublicEvCharger(`Public-EV-${i}`, pc.chargePower_kW, pc.sessionsPerDay, pc.avgSessionDurationHours));
    }

    // Peak-shaving battery (neighbourhood-level)
    if (config.peakShaving && config.peakShaving.enabled) {
      this.battery = new Battery('Neighbourhood-Battery', config.peakShaving);
      this._peakShavingConfig = config.peakShaving;
    } else {
      this.battery = null;
      this._peakShavingConfig = null;
    }

    // 24-hour history — size depends on step size
    this._maxHistoryEntries = Math.ceil((24 * 60) / config.simulation.stepSizeMinutes);
    this.history = [];
  }

  step(deltaTimeHours, weather, rng) {
    // Step all houses
    for (const house of this.houses) {
      house.step(deltaTimeHours, weather, rng);
    }
    // Step public chargers
    for (const charger of this.publicChargers) {
      charger.step(deltaTimeHours, weather, rng);
      charger.updateEnergy(charger.currentPower_kW, deltaTimeHours);
    }

    // Peak-shaving: compute and apply battery power
    if (this.battery) {
      const rawNet = this._rawNetPower_kW();
      const targetPower = PeakShavingController.compute(
        rawNet, this.battery, this._peakShavingConfig, deltaTimeHours,
      );
      this.battery.applyTargetPower(deltaTimeHours, targetPower);
      this.battery.updateEnergy(this.battery.currentPower_kW, deltaTimeHours);
    }
  }

  /** Raw net power (houses + chargers only, before battery). */
  _rawNetPower_kW() {
    let total = 0;
    for (const house of this.houses) total += house.netPower_kW;
    for (const charger of this.publicChargers) total += charger.currentPower_kW;
    return Math.round(total * 100) / 100;
  }

  /** Total net power including battery (positive = net consumption). */
  get netPower_kW() {
    let total = 0;
    for (const house of this.houses) total += house.netPower_kW;
    for (const charger of this.publicChargers) total += charger.currentPower_kW;
    if (this.battery) total += this.battery.currentPower_kW;
    return Math.round(total * 100) / 100;
  }

  /** Record current state to history (call after each step). */
  recordHistory(clockTime) {
    this.history.push({
      time: new Date(clockTime),
      netPower_kW: this.netPower_kW,
    });

    // Keep only the configured window
    if (this.history.length > this._maxHistoryEntries) {
      this.history = this.history.slice(-this._maxHistoryEntries);
    }
  }
}

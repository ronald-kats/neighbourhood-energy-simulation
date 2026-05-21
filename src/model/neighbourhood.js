import { House } from './house.js';
import { PublicEvCharger } from './public-ev-charger.js';

/**
 * The neighbourhood: all houses + public EV chargers.
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

    // 24-hour history, one entry per step (e.g. 1440 entries at 1-min steps)
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
  }

  /** Total net power of the entire neighbourhood (kW). Positive = net consumption. */
  get netPower_kW() {
    let total = 0;
    for (const house of this.houses) {
      total += house.netPower_kW;
    }
    for (const charger of this.publicChargers) {
      total += charger.currentPower_kW;
    }
    return Math.round(total * 100) / 100;
  }

  /** Record current state to history (call after each step). */
  recordHistory(clockTime) {
    this.history.push({
      time: new Date(clockTime),
      netPower_kW: this.netPower_kW,
    });

    // Keep only last 24 hours
    const maxEntries = 24 * 60; // 1440 entries for 1-min steps
    if (this.history.length > maxEntries) {
      this.history = this.history.slice(-maxEntries);
    }
  }
}

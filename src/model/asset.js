/**
 * Abstract base class for all energy assets.
 * Each asset tracks its current power and cumulative energy.
 */
export class Asset {
  constructor(name) {
    this.name = name;
    this.currentPower_kW = 0;
    this.cumulativeEnergy_kWh = 0;
  }

  /**
   * Advance the asset by one time step.
   * @param {number} deltaTimeHours — time step in hours
   * @param {() => number} rng — seeded PRNG function returning [0,1)
   */
  step(deltaTimeHours, rng) {
    throw new Error(`Asset "${this.name}" must implement step()`);
  }

  /** Record energy for this step. Positive = consumption, negative = generation. */
  updateEnergy(power_kW, deltaTimeHours) {
    this.currentPower_kW = power_kW;
    this.cumulativeEnergy_kWh += power_kW * deltaTimeHours;
  }
}
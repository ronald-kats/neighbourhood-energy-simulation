import { Asset } from './asset.js';

/**
 * Always-on household base load (lights, appliances, etc.).
 * Performs a bounded random walk around a base load value.
 */
export class BaseConsumption extends Asset {
  constructor(name, baseLoad_kW, variance_kW) {
    super(name);
    this.baseLoad_kW = baseLoad_kW;
    this.variance_kW = variance_kW;
    this.currentPower_kW = baseLoad_kW;
  }

  step(_deltaTimeHours, rng) {
    // Random walk: move up or down by up to 20% of variance
    const change = (rng() - 0.5) * 2 * this.variance_kW * 0.2;
    let newPower = this.currentPower_kW + change;
    // Clamp within baseLoad ± variance
    newPower = Math.max(this.baseLoad_kW - this.variance_kW, Math.min(this.baseLoad_kW + this.variance_kW, newPower));
    this.currentPower_kW = newPower;
    // Energy is accumulated by the house
  }
}
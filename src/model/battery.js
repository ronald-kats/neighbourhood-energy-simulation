import { Asset } from './asset.js';

/**
 * Neighbourhood-level battery for peak-shaving.
 * Stores energy and responds to charge/discharge commands from the
 * PeakShavingController. Enforces SoC bounds, power limits, and
 * round-trip efficiency.
 */
export class Battery extends Asset {
  /**
   * @param {string} name
   * @param {object} config — peakShaving config section
   */
  constructor(name, config) {
    super(name);
    this.capacity_kWh = config.batteryCapacity_kWh;
    this.maxChargePower_kW = config.maxChargePower_kW;
    this.maxDischargePower_kW = config.maxDischargePower_kW;
    this.minSocFraction = config.minSocFraction;
    this.maxSocFraction = config.maxSocFraction;
    this.roundTripEfficiency = config.roundTripEfficiency;
    this.stateOfCharge_kWh = config.initialSocFraction * config.batteryCapacity_kWh;
    this.currentPower_kW = 0;
  }

  /** State of charge as a fraction [0, 1]. */
  get socFraction() {
    return this.stateOfCharge_kWh / this.capacity_kWh;
  }

  /** Target SoC midpoint — the controller aims to keep the battery here. */
  get targetSoc() {
    return (this.minSocFraction + this.maxSocFraction) / 2;
  }

  /** Energy available for discharge above minSoC (kWh). */
  get availableDischargeEnergy_kWh() {
    return Math.max(0, this.stateOfCharge_kWh - this.minSocFraction * this.capacity_kWh);
  }

  /** Headroom available for charging below maxSoC (kWh). */
  get availableChargeCapacity_kWh() {
    return Math.max(0, this.maxSocFraction * this.capacity_kWh - this.stateOfCharge_kWh);
  }

  /**
   * No-op: the battery is controlled via applyTargetPower(), not through
   * the standard Asset.step() signature. Weather and PRNG do not influence
   * battery behaviour — it is purely algorithmic.
   */
  step(_deltaTimeHours, _weather, _rng) {}

  /**
   * Apply a target power to the battery, clamping to physical constraints.
   * Positive = charging (consumes from grid), negative = discharging (supplies to grid).
   *
   * @param {number} deltaTimeHours
   * @param {number} targetPower_kW
   */
  applyTargetPower(deltaTimeHours, targetPower_kW) {
    let power = targetPower_kW;

    // Clamp to power limits and SoC headroom
    if (power > 0) {
      const maxFromCapacity = this.availableChargeCapacity_kWh / deltaTimeHours;
      power = Math.min(power, this.maxChargePower_kW, maxFromCapacity);
    } else if (power < 0) {
      const maxFromEnergy = this.availableDischargeEnergy_kWh / deltaTimeHours;
      power = Math.max(power, -this.maxDischargePower_kW, -maxFromEnergy);
    }

    // Apply round-trip efficiency: sqrt(efficiency) per direction
    const eff = Math.sqrt(this.roundTripEfficiency);
    if (power > 0) {
      this.stateOfCharge_kWh += power * deltaTimeHours * eff;
    } else if (power < 0) {
      this.stateOfCharge_kWh += power * deltaTimeHours / eff;
    }

    // Floating-point safety: clamp SoC to bounds
    this.stateOfCharge_kWh = Math.max(
      this.minSocFraction * this.capacity_kWh,
      Math.min(this.maxSocFraction * this.capacity_kWh, this.stateOfCharge_kWh),
    );

    this.currentPower_kW = Math.round(power * 100) / 100;
  }
}

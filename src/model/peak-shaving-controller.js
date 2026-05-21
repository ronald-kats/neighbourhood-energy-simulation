/**
 * Stateless peak-shaving controller.
 *
 * Determines the target battery power each step based on the
 * neighbourhood's raw net power (before battery) and the battery's
 * current state.  Separated from Battery for independent testability
 * and to allow swapping algorithms later.
 */
export class PeakShavingController {
  /**
   * Compute the target battery power for this step.
   *
   * Rules (evaluated in order):
   *   1. rawNetPower > threshold  → discharge to shave the peak
   *   2. rawNetPower < 0          → charge from excess solar
   *   3. soc < targetSoc          → gentle charge toward target
   *   4. otherwise                → idle
   *
   * @param {number} rawNetPower_kW — neighbourhood net power before battery
   * @param {import('./battery.js').Battery} battery
   * @param {object} config — peakShaving config section
   * @param {number} deltaTimeHours — simulation step in hours
   * @returns {number} target power: positive = charge, negative = discharge
   */
  static compute(rawNetPower_kW, battery, config, deltaTimeHours) {
    // Rule 1 — discharge when above threshold
    if (rawNetPower_kW > config.peakThreshold_kW) {
      const excess = rawNetPower_kW - config.peakThreshold_kW;
      const maxDischarge = Math.min(
        excess,
        battery.maxDischargePower_kW,
        battery.availableDischargeEnergy_kWh / deltaTimeHours,
      );
      if (maxDischarge > 0) return -maxDischarge;
    }

    // Rule 2 — charge from excess solar
    if (rawNetPower_kW < 0) {
      const excessGeneration = -rawNetPower_kW;
      const maxCharge = Math.min(
        excessGeneration,
        battery.maxChargePower_kW,
        battery.availableChargeCapacity_kWh / deltaTimeHours,
      );
      if (maxCharge > 0) return maxCharge;
    }

    // Rule 3 — gentle charge toward target SoC (25 % of max rate)
    if (battery.socFraction < battery.targetSoc) {
      const gentleRate = battery.maxChargePower_kW * 0.25;
      const maxCharge = Math.min(
        gentleRate,
        battery.availableChargeCapacity_kWh / deltaTimeHours,
      );
      if (maxCharge > 0) return maxCharge;
    }

    // Rule 4 — idle
    return 0;
  }
}

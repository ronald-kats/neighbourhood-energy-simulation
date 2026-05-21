import { BaseConsumption } from './base-consumption.js';
import { HeatPump } from './heat-pump.js';
import { PV } from './pv.js';
import { HomeEvCharger } from './home-ev-charger.js';

/**
 * A house contains multiple energy assets.
 * Net power = sum of all asset powers (PV generates negative = offsets load).
 * Power limit caps net consumption (import from grid).
 */
export class House {
  /**
   * @param {number} id
   * @param {object} housesConfig — the houses section of the parsed config
   * @param {object} weatherConfig — the weather section of the parsed config
   */
  constructor(id, housesConfig, weatherConfig) {
    this.id = id;
    this.powerLimit_kW = housesConfig.powerLimit_kW;

    const a = housesConfig.assets;
    const w = weatherConfig;
    this.assets = [
      new BaseConsumption(
        `House${id}-BaseLoad`,
        a.baseConsumption.baseLoad_kW,
        a.baseConsumption.variance_kW,
        w.enableBaseLoadModulation,
        w.baseLoadSeasonalVariation,
      ),
      new HeatPump(
        `House${id}-HeatPump`,
        a.heatPump.maxPower_kW,
        w.indoorTargetTemperature_C,
        w.thermalLossCoefficient,
        w.cop,
      ),
      new PV(`House${id}-PV`, a.pv.peakPower_kW),
      new HomeEvCharger(
        `House${id}-EVCharger`,
        a.homeEvCharger.chargePower_kW,
        a.homeEvCharger.sessionsPerDay,
        a.homeEvCharger.avgSessionDurationHours,
      ),
    ];
  }

  /** Step all assets and return net power (positive = consumption, negative = generation). */
  step(deltaTimeHours, weather, rng) {
    for (const asset of this.assets) {
      asset.step(deltaTimeHours, weather, rng);
    }
    // Accumulate energy for each asset
    for (const asset of this.assets) {
      asset.updateEnergy(asset.currentPower_kW, deltaTimeHours);
    }
  }

  /** Net power: sum of all asset powers. */
  get netPower_kW() {
    let total = 0;
    for (const asset of this.assets) {
      total += asset.currentPower_kW;
    }
    return Math.round(total * 100) / 100;
  }
}

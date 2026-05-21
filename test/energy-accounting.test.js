import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Asset } from '../src/model/asset.js';
import { BaseConsumption } from '../src/model/base-consumption.js';
import { PV } from '../src/model/pv.js';
import { HeatPump } from '../src/model/heat-pump.js';
import { createRNG } from '../src/simulation/rng.js';

describe('Energy Accounting', () => {
  it('Asset.updateEnergy accumulates energy correctly', () => {
    const asset = new Asset('TestAsset');
    asset.updateEnergy(2.5, 0.5); // 2.5 kW for 0.5 hours = 1.25 kWh
    assert.equal(asset.cumulativeEnergy_kWh, 1.25);
    assert.equal(asset.currentPower_kW, 2.5);
  });

  it('Asset.updateEnergy accumulates over multiple steps', () => {
    const asset = new Asset('TestAsset');
    asset.updateEnergy(3, 1 / 60);   // 3 kW for 1 min = 0.05 kWh
    asset.updateEnergy(7, 1 / 60);   // 7 kW for 1 min = 0.1167 kWh
    asset.updateEnergy(0, 1 / 60);   // 0 kW for 1 min
    const expected = (3 + 7 + 0) / 60;
    assert.ok(Math.abs(asset.cumulativeEnergy_kWh - expected) < 0.001);
  });

  it('negative power reduces cumulative energy (generation)', () => {
    const asset = new Asset('Solar');
    asset.updateEnergy(-5, 0.5); // -5 kW for 0.5 hours = -2.5 kWh
    assert.equal(asset.cumulativeEnergy_kWh, -2.5);
  });

  it('base consumption stays within bounds', () => {
    const rng = createRNG(42);
    const bc = new BaseConsumption('Base', 0.5, 0.2);
    // Run many steps
    for (let i = 0; i < 1000; i++) {
      bc.step(1 / 60, rng);
      bc.updateEnergy(bc.currentPower_kW, 1 / 60);
    }
    // Should never exceed baseLoad ± variance
    assert.ok(bc.currentPower_kW >= 0.3, `Power ${bc.currentPower_kW} should be >= 0.3`);
    assert.ok(bc.currentPower_kW <= 0.7, `Power ${bc.currentPower_kW} should be <= 0.7`);
    // Accumulated energy should be positive (consumption)
    assert.ok(bc.cumulativeEnergy_kWh > 0);
  });

  it('PV generates at night and more during day', () => {
    const rng = createRNG(99);
    const pv = new PV('Solar', 5);

    // Nighttime (hour 2): should produce zero
    pv.step(1 / 60, rng, { month: 6, hour: 2 });
    assert.equal(pv.currentPower_kW, 0);

    // Daytime (hour 12): should produce negative power (generation)
    pv.step(1 / 60, rng, { month: 6, hour: 12 });
    assert.ok(pv.currentPower_kW < 0, `Expected negative power at noon, got ${pv.currentPower_kW}`);
  });

  it('PV produces more in summer than winter', () => {
    const rng = createRNG(123);
    const pvSummer = new PV('Solar-Summer', 5);
    const pvWinter = new PV('Solar-Winter', 5);

    // With fixed rng() value of 0.5 (clear sky), compare seasonal factors
    // Summer month=7, Winter month=1, both at noon
    const rngSummer = createRNG(999);
    const rngWinter = createRNG(999);

    pvSummer.step(1 / 60, rngSummer, { month: 7, hour: 12 });
    pvWinter.step(1 / 60, rngWinter, { month: 1, hour: 12 });

    // Summer PV should generate more (more negative) than winter
    assert.ok(pvSummer.currentPower_kW < pvWinter.currentPower_kW,
      `Summer ${pvSummer.currentPower_kW} should be more negative than winter ${pvWinter.currentPower_kW}`);
  });

  it('heat pump consumes more in winter than summer', () => {
    const rngWinter = createRNG(42);
    const rngSummer = createRNG(42);

    const hpWinter = new HeatPump('HP-Winter', 3);
    const hpSummer = new HeatPump('HP-Summer', 3);

    // Both with same rng sequence
    hpWinter.step(1 / 60, rngWinter, { month: 1 }); // January
    hpSummer.step(1 / 60, rngSummer, { month: 7 }); // July

    // Winter consumption should be >= summer consumption
    assert.ok(hpWinter.currentPower_kW >= hpSummer.currentPower_kW,
      `Winter ${hpWinter.currentPower_kW} should be >= summer ${hpSummer.currentPower_kW}`);
  });
});
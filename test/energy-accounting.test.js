import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Asset } from '../src/model/asset.js';
import { BaseConsumption } from '../src/model/base-consumption.js';
import { PV } from '../src/model/pv.js';
import { HeatPump } from '../src/model/heat-pump.js';
import { WeatherCondition } from '../src/model/weather-condition.js';
import { Season } from '../src/model/season.js';
import { createRNG } from '../src/simulation/rng.js';

function makeWeather(overrides = {}) {
  return new WeatherCondition({
    temperature_C: overrides.temperature_C ?? 15,
    irradianceFactor: overrides.irradianceFactor ?? 0.5,
    cloudCover: overrides.cloudCover ?? 0.3,
    season: overrides.season ?? Season.SUMMER,
    timestamp: overrides.timestamp ?? new Date('2024-07-15T12:00:00'),
  });
}

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
    const weather = makeWeather();
    const bc = new BaseConsumption('Base', 0.5, 0.2, false); // modulation disabled for this test
    // Run many steps
    for (let i = 0; i < 1000; i++) {
      bc.step(1 / 60, weather, rng);
      bc.updateEnergy(bc.currentPower_kW, 1 / 60);
    }
    // Should never exceed baseLoad ± variance
    assert.ok(bc.currentPower_kW >= 0.3, `Power ${bc.currentPower_kW} should be >= 0.3`);
    assert.ok(bc.currentPower_kW <= 0.7, `Power ${bc.currentPower_kW} should be <= 0.7`);
    // Accumulated energy should be positive (consumption)
    assert.ok(bc.cumulativeEnergy_kWh > 0);
  });

  it('PV generates zero at night and negative power during day', () => {
    const pv = new PV('Solar', 5);

    // Nighttime: irradianceFactor = 0
    const nightWeather = makeWeather({ irradianceFactor: 0 });
    pv.step(1 / 60, nightWeather, null);
    assert.equal(pv.currentPower_kW, 0);

    // Daytime: irradianceFactor = 0.8
    const dayWeather = makeWeather({ irradianceFactor: 0.8 });
    pv.step(1 / 60, dayWeather, null);
    assert.ok(pv.currentPower_kW < 0, `Expected negative power with irradiance 0.8, got ${pv.currentPower_kW}`);
  });

  it('PV power equals peakPower * irradianceFactor', () => {
    const pv = new PV('Solar', 5);
    const weather = makeWeather({ irradianceFactor: 0.6 });
    pv.step(1 / 60, weather, null);
    assert.equal(pv.currentPower_kW, -(5 * 0.6));
  });

  it('heat pump consumes more when cold than when mild', () => {
    const hpCold = new HeatPump('HP-Cold', 3, 20, 0.15, 3.5);
    const hpMild = new HeatPump('HP-Mild', 3, 20, 0.15, 3.5);

    const coldWeather = makeWeather({ temperature_C: 0 });
    const mildWeather = makeWeather({ temperature_C: 15 });

    hpCold.step(1 / 60, coldWeather, null);
    hpMild.step(1 / 60, mildWeather, null);

    assert.ok(hpCold.currentPower_kW > hpMild.currentPower_kW,
      `Cold ${hpCold.currentPower_kW} should be > mild ${hpMild.currentPower_kW}`);
  });

  it('heat pump idles when outdoor temp >= indoor target', () => {
    const hp = new HeatPump('HP-Warm', 3, 20, 0.15, 3.5);
    const warmWeather = makeWeather({ temperature_C: 22 });

    hp.step(1 / 60, warmWeather, null);
    assert.equal(hp.currentPower_kW, 0, 'Heat pump should idle when outdoor >= indoor target');
  });
});

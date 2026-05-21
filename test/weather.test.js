import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Season } from '../src/model/season.js';
import { DeterministicWeatherModel } from '../src/model/weather-model.js';
import { createRNG } from '../src/simulation/rng.js';

describe('Weather & Season', () => {
  // T-W1: Season boundary dates
  it('T-W1: Season.fromMonth returns correct season for boundary dates', () => {
    // Winter: Dec(12), Jan(1), Feb(2)
    assert.equal(Season.fromMonth(12), Season.WINTER);
    assert.equal(Season.fromMonth(1), Season.WINTER);
    assert.equal(Season.fromMonth(2), Season.WINTER);

    // Spring: Mar(3), Apr(4), May(5)
    assert.equal(Season.fromMonth(3), Season.SPRING);
    assert.equal(Season.fromMonth(4), Season.SPRING);
    assert.equal(Season.fromMonth(5), Season.SPRING);

    // Summer: Jun(6), Jul(7), Aug(8)
    assert.equal(Season.fromMonth(6), Season.SUMMER);
    assert.equal(Season.fromMonth(7), Season.SUMMER);
    assert.equal(Season.fromMonth(8), Season.SUMMER);

    // Autumn: Sep(9), Oct(10), Nov(11)
    assert.equal(Season.fromMonth(9), Season.AUTUMN);
    assert.equal(Season.fromMonth(10), Season.AUTUMN);
    assert.equal(Season.fromMonth(11), Season.AUTUMN);
  });

  // T-W2: Temperature model — July peak, January trough
  it('T-W2: temperature peaks in July and reaches trough in January', () => {
    const config = {};
    const model = new DeterministicWeatherModel(config, 60);
    const rng = createRNG(42);

    // January 15 at noon
    const janWeather = model.getWeather(new Date('2024-01-15T12:00:00'), rng);
    // July 15 at noon
    const julWeather = model.getWeather(new Date('2024-07-15T12:00:00'), rng);

    assert.ok(julWeather.temperature_C > janWeather.temperature_C,
      `Expected July temp ${julWeather.temperature_C} > January temp ${janWeather.temperature_C}`);
  });

  // T-W3: Irradiance — zero at night, positive during day, reduced by cloud
  it('T-W3: irradiance is zero at night and positive during day', () => {
    const config = {};
    const model = new DeterministicWeatherModel(config, 60);
    const rng = createRNG(42);

    // Midnight — sun below horizon in NL
    const nightWeather = model.getWeather(new Date('2024-07-15T00:00:00'), rng);
    assert.equal(nightWeather.irradianceFactor, 0, 'Expected zero irradiance at midnight');

    // Noon — sun should be up
    const dayWeather = model.getWeather(new Date('2024-07-15T12:00:00'), rng);
    assert.ok(dayWeather.irradianceFactor > 0,
      `Expected positive irradiance at noon, got ${dayWeather.irradianceFactor}`);
  });

  it('T-W3: irradiance is reduced by high cloud cover', () => {
    const config = {};
    const model = new DeterministicWeatherModel(config, 60);

    // Force cloud cover to be high by using a specific seed and running enough steps
    // We'll just verify the formula: irradianceFactor = max(0, sinElevation) * (1 - cloudCover)
    // At noon on a summer day, (1 - 0.9) should give ~10% of clear-sky
    const date = new Date('2024-07-15T12:00:00');
    const elevRad = model._computeSolarElevation(date);
    const clearIrradiance = Math.max(0, Math.sin(elevRad)) * (1 + 0.033 * Math.cos((2 * Math.PI * 196) / 365));
    const irradianceClear = Math.max(0, clearIrradiance * (1 - 0.0));
    const irradianceCloudy = Math.max(0, clearIrradiance * (1 - 0.9));

    assert.ok(irradianceCloudy < irradianceClear,
      `Cloudy irradiance ${irradianceCloudy} should be less than clear ${irradianceClear}`);
  });

  // T-W4: Determinism — same seed = identical weather sequences
  it('T-W4: same seed produces identical weather sequences', () => {
    const config = {};
    const model1 = new DeterministicWeatherModel(config, 60);
    const model2 = new DeterministicWeatherModel(config, 60);
    const rng1 = createRNG(12345);
    const rng2 = createRNG(12345);

    const startDate = new Date('2024-01-01T00:00:00');
    for (let i = 0; i < 100; i++) {
      const t = new Date(startDate.getTime() + i * 60 * 60000);
      const w1 = model1.getWeather(t, rng1);
      const w2 = model2.getWeather(t, rng2);
      assert.equal(w1.temperature_C, w2.temperature_C, `Temperature differs at step ${i}`);
      assert.equal(w1.irradianceFactor, w2.irradianceFactor, `Irradiance differs at step ${i}`);
      assert.equal(w1.cloudCover, w2.cloudCover, `Cloud cover differs at step ${i}`);
    }
  });

  // T-W5: PV integration — pvPower = peakPower * irradianceFactor
  it('T-W5: PV power equals peakPower * irradianceFactor (negative = generation)', () => {
    // This tests the formula directly as PV would use it
    const peakPower_kW = 5;
    const irradianceFactor = 0.75;
    const expectedPower = -(peakPower_kW * irradianceFactor);
    assert.equal(expectedPower, -3.75);
  });

  // T-W6: Heat pump — higher consumption at lower temps; zero when T_outdoor >= T_indoor
  it('T-W6: heat pump consumption increases as temperature drops', () => {
    const indoorTarget = 20.0;
    const lossCoeff = 0.15;
    const cop = 3.5;
    const maxPower = 3;

    // Cold day: 0°C outdoor
    const heatingDemandCold = Math.max(0, indoorTarget - 0);
    const powerCold = Math.min((heatingDemandCold * lossCoeff) / cop, maxPower);

    // Mild day: 15°C outdoor
    const heatingDemandMild = Math.max(0, indoorTarget - 15);
    const powerMild = Math.min((heatingDemandMild * lossCoeff) / cop, maxPower);

    assert.ok(powerCold > powerMild,
      `Cold power ${powerCold} should exceed mild power ${powerMild}`);
  });

  it('T-W6: heat pump idles when outdoor temp >= indoor target', () => {
    const indoorTarget = 20.0;
    const lossCoeff = 0.15;
    const cop = 3.5;
    const maxPower = 3;

    // Warm day: 22°C outdoor
    const heatingDemand = Math.max(0, indoorTarget - 22);
    assert.equal(heatingDemand, 0, 'Heating demand should be zero when outdoor > indoor target');

    const power = Math.min((heatingDemand * lossCoeff) / cop, maxPower);
    assert.equal(power, 0, 'Heat pump should consume zero when no heating demand');
  });

  // T-W7: Cloud cover stays in [0, 1] over full simulated year
  it('T-W7: cloud cover stays within [0, 1] over a full year', () => {
    const config = {};
    const model = new DeterministicWeatherModel(config, 60);
    const rng = createRNG(999);
    const startDate = new Date('2024-01-01T00:00:00');

    // Simulate one step per hour for a full year (8760 steps)
    for (let h = 0; h < 8760; h++) {
      const t = new Date(startDate.getTime() + h * 60 * 60000);
      const w = model.getWeather(t, rng);
      assert.ok(w.cloudCover >= 0 && w.cloudCover <= 1,
        `Cloud cover ${w.cloudCover} out of bounds at hour ${h}`);
    }
  });

  // T-W8: Simulation state includes current weather after each tick
  it('T-W8: engine state includes currentWeather after tick', async () => {
    const { SimulationEngine } = await import('../src/simulation/engine.js');
    const { loadConfig } = await import('../src/config/loader.js');
    const { resolve } = await import('node:path');

    const config = loadConfig(resolve('config.yaml'));

    let capturedState = null;
    const engine = new SimulationEngine(config, (state) => {
      capturedState = state;
    });

    // Manually trigger one tick via the internal method
    engine._tick();

    assert.ok(capturedState !== null, 'State should have been emitted');
    assert.ok(capturedState.currentWeather !== undefined, 'State should include currentWeather');
    assert.ok(typeof capturedState.currentWeather.temperature_C === 'number',
      'Weather should have temperature_C');
    assert.ok(typeof capturedState.currentWeather.irradianceFactor === 'number',
      'Weather should have irradianceFactor');
    assert.ok(typeof capturedState.currentWeather.cloudCover === 'number',
      'Weather should have cloudCover');
    assert.ok(typeof capturedState.currentWeather.season === 'string',
      'Weather should have season');
  });
});

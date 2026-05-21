import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRNG } from '../src/simulation/rng.js';
import { Neighbourhood } from '../src/model/neighbourhood.js';
import { DeterministicWeatherModel } from '../src/model/weather-model.js';
import { loadConfig } from '../src/config/loader.js';
import { resolve } from 'node:path';

describe('Reproducibility', () => {
  it('mulberry32 produces identical sequences from same seed', () => {
    const rng1 = createRNG(12345);
    const rng2 = createRNG(12345);

    for (let i = 0; i < 100; i++) {
      assert.equal(rng1(), rng2(), `Values differ at position ${i}`);
    }
  });

  it('mulberry32 produces different sequences from different seeds', () => {
    const rng1 = createRNG(12345);
    const rng2 = createRNG(54321);

    // At least one of the first 10 values should differ
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) {
        allSame = false;
        break;
      }
    }
    assert.equal(allSame, false, 'Different seeds should produce different values');
  });

  it('neighbourhood simulation is deterministic with same seed', () => {
    const configPath = resolve('config.yaml');
    const config = loadConfig(configPath);

    // Run two simulations with the same seed
    const run1 = runSimulation(config, 12345, 60);
    const run2 = runSimulation(config, 12345, 60);

    // Compare cumulative energy for all houses
    assert.equal(run1.houses.length, run2.houses.length);
    for (let i = 0; i < run1.houses.length; i++) {
      for (let j = 0; j < run1.houses[i].assets.length; j++) {
        const e1 = run1.houses[i].assets[j].cumulativeEnergy_kWh;
        const e2 = run2.houses[i].assets[j].cumulativeEnergy_kWh;
        assert.ok(Math.abs(e1 - e2) < 0.0001,
          `House ${i + 1} asset ${j}: ${e1} vs ${e2} differ`);
      }
    }

    // Compare public chargers
    for (let i = 0; i < run1.publicChargers.length; i++) {
      const e1 = run1.publicChargers[i].cumulativeEnergy_kWh;
      const e2 = run2.publicChargers[i].cumulativeEnergy_kWh;
      assert.ok(Math.abs(e1 - e2) < 0.0001,
        `Charger ${i + 1}: ${e1} vs ${e2} differ`);
    }
  });

  it('different seeds produce different results', () => {
    const configPath = resolve('config.yaml');
    const config = loadConfig(configPath);

    const run1 = runSimulation(config, 11111, 60);
    const run2 = runSimulation(config, 99999, 60);

    // At least one house should have different cumulative energy
    let anyDifferent = false;
    for (let i = 0; i < run1.houses.length; i++) {
      for (let j = 0; j < run1.houses[i].assets.length; j++) {
        const e1 = run1.houses[i].assets[j].cumulativeEnergy_kWh;
        const e2 = run2.houses[i].assets[j].cumulativeEnergy_kWh;
        if (Math.abs(e1 - e2) > 0.0001) {
          anyDifferent = true;
          break;
        }
      }
      if (anyDifferent) break;
    }
    assert.equal(anyDifferent, true, 'Different seeds should produce different cumulative energy values');
  });
});

/**
 * Helper: run a simulation for a given number of ticks and return the neighbourhood state.
 */
function runSimulation(config, seed, ticks) {
  const overrides = {
    ...config,
    simulation: { ...config.simulation, seed },
  };

  const rng = createRNG(seed);
  const weatherModel = new DeterministicWeatherModel(config.weather, overrides.simulation.stepSizeMinutes);
  const neighbourhood = new Neighbourhood(overrides);
  const deltaTimeHours = overrides.simulation.stepSizeMinutes / 60;

  // Simulate starting from Jan 1
  const startDate = new Date('2024-01-01T00:00:00');

  for (let t = 0; t < ticks; t++) {
    const simTime = new Date(startDate.getTime() + t * overrides.simulation.stepSizeMinutes * 60000);
    const weather = weatherModel.getWeather(simTime, rng);

    neighbourhood.step(deltaTimeHours, weather, rng);
    neighbourhood.recordHistory(simTime);
  }

  return {
    houses: neighbourhood.houses.map(house => ({
      assets: house.assets.map(a => ({
        cumulativeEnergy_kWh: a.cumulativeEnergy_kWh,
      })),
    })),
    publicChargers: neighbourhood.publicChargers.map(c => ({
      cumulativeEnergy_kWh: c.cumulativeEnergy_kWh,
    })),
  };
}

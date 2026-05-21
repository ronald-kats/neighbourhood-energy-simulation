import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Battery } from '../src/model/battery.js';
import { PeakShavingController } from '../src/model/peak-shaving-controller.js';
import { Neighbourhood } from '../src/model/neighbourhood.js';
import { DeterministicWeatherModel } from '../src/model/weather-model.js';
import { createRNG } from '../src/simulation/rng.js';
import { loadConfig } from '../src/config/loader.js';
import { resolve } from 'node:path';

const defaultPeakShavingConfig = {
  enabled: true,
  batteryCapacity_kWh: 500,
  maxChargePower_kW: 250,
  maxDischargePower_kW: 250,
  peakThreshold_kW: 120,
  roundTripEfficiency: 0.90,
  minSocFraction: 0.10,
  maxSocFraction: 0.90,
  initialSocFraction: 0.50,
};

describe('Peak-Shaving', () => {
  // T-P1: Battery enforces SoC bounds
  it('T-P1: battery enforces SoC bounds', () => {
    const battery = new Battery('Test-Battery', defaultPeakShavingConfig);

    // Try to discharge below minSoC
    battery.stateOfCharge_kWh = 51; // just above 10% of 500 = 50
    battery.applyTargetPower(1, -100); // try to discharge 100 kW for 1 hour
    assert.ok(battery.stateOfCharge_kWh >= 50,
      `SoC ${battery.stateOfCharge_kWh} should not drop below minSoC (50 kWh)`);

    // Try to charge above maxSoC
    battery.stateOfCharge_kWh = 449; // just below 90% of 500 = 450
    battery.applyTargetPower(1, 100); // try to charge 100 kW for 1 hour
    assert.ok(battery.stateOfCharge_kWh <= 450,
      `SoC ${battery.stateOfCharge_kWh} should not exceed maxSoC (450 kWh)`);
  });

  // T-P1b: Battery enforces power limits
  it('T-P1: battery respects max charge/discharge power limits', () => {
    const battery = new Battery('Test-Battery', {
      ...defaultPeakShavingConfig,
      maxChargePower_kW: 50,
      maxDischargePower_kW: 80,
    });
    // Start at 50% SoC so both charge and discharge are possible
    battery.stateOfCharge_kWh = 250;

    // Try to charge at 200 kW — should be capped at 50
    battery.applyTargetPower(1, 200);
    assert.ok(battery.currentPower_kW <= 50,
      `Charge power ${battery.currentPower_kW} should be capped at 50 kW`);

    // Try to discharge at 200 kW — should be capped at 80
    battery.stateOfCharge_kWh = 250;
    battery.applyTargetPower(1, -200);
    assert.ok(battery.currentPower_kW >= -80,
      `Discharge power ${battery.currentPower_kW} should be capped at -80 kW`);
  });

  // T-P2: Battery discharges when net power exceeds peak threshold
  it('T-P2: battery discharges when net power exceeds peak threshold', () => {
    const battery = new Battery('Test-Battery', defaultPeakShavingConfig);
    battery.stateOfCharge_kWh = 250; // 50%

    const target = PeakShavingController.compute(200, battery, defaultPeakShavingConfig, 1);
    assert.ok(target < 0, `Expected discharge (negative), got ${target}`);
    // Should discharge at min(excess, maxDischargePower) = min(80, 250) = 80
    assert.equal(target, -80);
  });

  // T-P3: Battery charges from excess solar when net power is negative
  it('T-P3: battery charges from excess solar when net power is negative', () => {
    const battery = new Battery('Test-Battery', defaultPeakShavingConfig);
    battery.stateOfCharge_kWh = 250; // 50%, has charge headroom

    const target = PeakShavingController.compute(-50, battery, defaultPeakShavingConfig, 1);
    assert.ok(target > 0, `Expected charging (positive), got ${target}`);
    // Should charge at min(excess, maxChargePower) = min(50, 250) = 50
    assert.equal(target, 50);
  });

  // T-P4: Battery gently charges toward target SoC during moderate load
  it('T-P4: battery gently charges toward target SoC when below it', () => {
    const battery = new Battery('Test-Battery', defaultPeakShavingConfig);
    battery.stateOfCharge_kWh = 100; // 20% — well below target of 50%

    const target = PeakShavingController.compute(30, battery, defaultPeakShavingConfig, 1);
    assert.ok(target > 0, `Expected gentle charge (positive), got ${target}`);
    // Gentle rate = 25% of maxChargePower = 62.5 kW
    assert.ok(target <= 62.5, `Gentle charge ${target} should be <= 62.5 kW`);
  });

  // T-P5: Battery idles when at target SoC and net power is below threshold
  it('T-P5: battery idles at target SoC with moderate load', () => {
    const battery = new Battery('Test-Battery', defaultPeakShavingConfig);
    battery.stateOfCharge_kWh = 250; // 50% = target SoC

    const target = PeakShavingController.compute(30, battery, defaultPeakShavingConfig, 1);
    assert.equal(target, 0, 'Battery should idle');
  });

  // T-P6: Charge/discharge respects power limits (already covered in T-P1b)

  // T-P7: Round-trip efficiency is correctly applied
  it('T-P7: round-trip efficiency is correctly applied', () => {
    const battery = new Battery('Test-Battery', {
      ...defaultPeakShavingConfig,
      roundTripEfficiency: 0.81, // sqrt = 0.9 per direction
    });
    battery.stateOfCharge_kWh = 250;

    // Charge 100 kW for 1 hour — stores 100 * 0.9 = 90 kWh
    battery.applyTargetPower(1, 100);
    assert.ok(Math.abs(battery.stateOfCharge_kWh - 340) < 0.01,
      `SoC after charge should be ~340 kWh, got ${battery.stateOfCharge_kWh}`);

    // Discharge 100 kW for 1 hour — withdraws 100 / 0.9 = 111.1 kWh from storage
    battery.applyTargetPower(1, -100);
    assert.ok(Math.abs(battery.stateOfCharge_kWh - 228.89) < 0.1,
      `SoC after discharge should be ~228.9 kWh, got ${battery.stateOfCharge_kWh}`);
  });

  // T-P8: Neighbourhood net power includes battery contribution
  it('T-P8: neighbourhood net power includes battery contribution', () => {
    const configPath = resolve('config.yaml');
    const config = loadConfig(configPath);

    const rng = createRNG(42);
    const weatherModel = new DeterministicWeatherModel(config.weather, config.simulation.stepSizeMinutes);
    const neighbourhood = new Neighbourhood(config);

    // Run one step
    const simTime = new Date('2024-01-01T12:00:00');
    const weather = weatherModel.getWeather(simTime, rng);
    neighbourhood.step(1, weather, rng);

    // Get the raw net power (without battery)
    const rawNet = neighbourhood._rawNetPower_kW();
    // Get the effective net power (with battery)
    const effectiveNet = neighbourhood.netPower_kW;

    // Effective should equal raw + battery
    const batteryPower = neighbourhood.battery.currentPower_kW;
    const expected = Math.round((rawNet + batteryPower) * 100) / 100;
    assert.equal(effectiveNet, expected,
      `Effective net ${effectiveNet} should equal raw ${rawNet} + battery ${batteryPower} = ${expected}`);
  });

  // T-P9: Same seed + config produces identical peak-shaving behaviour
  it('T-P9: peak-shaving is deterministic with same seed', () => {
    const configPath = resolve('config.yaml');
    const config = loadConfig(configPath);

    const run1 = runWithPeakShaving(config, 12345, 48); // 48 hours
    const run2 = runWithPeakShaving(config, 12345, 48);

    // Compare battery state at end
    assert.ok(Math.abs(run1.batterySoC_kWh - run2.batterySoC_kWh) < 0.001,
      `Battery SoC differs: ${run1.batterySoC_kWh} vs ${run2.batterySoC_kWh}`);
    assert.ok(Math.abs(run1.batteryEnergy_kWh - run2.batteryEnergy_kWh) < 0.001,
      `Battery energy differs: ${run1.batteryEnergy_kWh} vs ${run2.batteryEnergy_kWh}`);
  });

  // T-P10: Battery SoC reflects seasonal weather patterns over a simulated week
  it('T-P10: battery SoC varies with seasonal weather over a week', () => {
    const configPath = resolve('config.yaml');
    const config = loadConfig(configPath);

    // Winter week (January)
    const winterRun = runWithPeakShaving(config, 42, 168); // 1 week
    // Summer week (July)
    const summerConfig = {
      ...config,
      simulation: { ...config.simulation, startTime: '2024-07-01T00:00:00' },
    };
    const summerRun = runWithPeakShaving(summerConfig, 42, 168);

    // In summer, more PV generation → battery charges more
    // In winter, higher demand → battery discharges more
    // We should see at least some SoC difference
    assert.ok(Math.abs(winterRun.batterySoC_kWh - summerRun.batterySoC_kWh) > 0,
      'Winter and summer battery SoC should differ due to seasonal weather patterns');
  });
});

/**
 * Helper: run a simulation with peak-shaving and return final battery state.
 */
function runWithPeakShaving(config, seed, ticks) {
  const overrides = {
    ...config,
    simulation: { ...config.simulation, seed },
  };

  const rng = createRNG(seed);
  const weatherModel = new DeterministicWeatherModel(
    config.weather, overrides.simulation.stepSizeMinutes,
  );
  const neighbourhood = new Neighbourhood(overrides);
  const deltaTimeHours = overrides.simulation.stepSizeMinutes / 60;
  const startDate = new Date(overrides.simulation.startTime);

  for (let t = 0; t < ticks; t++) {
    const simTime = new Date(startDate.getTime() + t * overrides.simulation.stepSizeMinutes * 60000);
    const weather = weatherModel.getWeather(simTime, rng);
    neighbourhood.step(deltaTimeHours, weather, rng);
  }

  return {
    batterySoC_kWh: neighbourhood.battery ? neighbourhood.battery.stateOfCharge_kWh : 0,
    batteryEnergy_kWh: neighbourhood.battery ? neighbourhood.battery.cumulativeEnergy_kWh : 0,
  };
}

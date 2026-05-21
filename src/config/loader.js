import { readFileSync } from 'node:fs';
import { load as loadYaml } from 'js-yaml';

/**
 * Load and validate the YAML configuration file.
 * Returns a structured config object with defaults applied.
 */
export function loadConfig(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = loadYaml(raw);

  // Validate required sections
  if (!parsed.simulation) {
    throw new Error('Config missing "simulation" section');
  }
  if (!parsed.houses) {
    throw new Error('Config missing "houses" section');
  }
  if (!parsed.publicChargers) {
    throw new Error('Config missing "publicChargers" section');
  }

  return {
    simulation: {
      stepSizeMinutes: parsed.simulation.stepSizeMinutes ?? 1,
      seed: parsed.simulation.seed ?? 12345,
      speedMultiplier: parsed.simulation.speedMultiplier ?? 60,
      startTime: parsed.simulation.startTime ?? '2024-01-01T00:00:00',
    },
    houses: {
      count: parsed.houses.count ?? 30,
      powerLimit_kW: parsed.houses.powerLimit_kW ?? 10,
      assets: {
        baseConsumption: {
          baseLoad_kW: parsed.houses.assets?.baseConsumption?.baseLoad_kW ?? 0.5,
          variance_kW: parsed.houses.assets?.baseConsumption?.variance_kW ?? 0.2,
        },
        heatPump: {
          maxPower_kW: parsed.houses.assets?.heatPump?.maxPower_kW ?? 3,
        },
        pv: {
          peakPower_kW: parsed.houses.assets?.pv?.peakPower_kW ?? 5,
        },
        homeEvCharger: {
          chargePower_kW: parsed.houses.assets?.homeEvCharger?.chargePower_kW ?? 7,
          sessionsPerDay: parsed.houses.assets?.homeEvCharger?.sessionsPerDay ?? 2,
          avgSessionDurationHours: parsed.houses.assets?.homeEvCharger?.avgSessionDurationHours ?? 2,
        },
      },
    },
    publicChargers: {
      count: parsed.publicChargers.count ?? 6,
      chargePower_kW: parsed.publicChargers.chargePower_kW ?? 22,
      sessionsPerDay: parsed.publicChargers.sessionsPerDay ?? 10,
      avgSessionDurationHours: parsed.publicChargers.avgSessionDurationHours ?? 1,
    },
  };
}
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
    weather: {
      latitude: parsed.weather?.latitude ?? 52.0,
      annualMeanTemperature_C: parsed.weather?.annualMeanTemperature_C ?? 10.0,
      annualTemperatureAmplitude_C: parsed.weather?.annualTemperatureAmplitude_C ?? 7.0,
      diurnalTemperatureAmplitude_C: parsed.weather?.diurnalTemperatureAmplitude_C ?? 5.0,
      temperatureNoiseRange_C: parsed.weather?.temperatureNoiseRange_C ?? 1.5,
      indoorTargetTemperature_C: parsed.weather?.indoorTargetTemperature_C ?? 20.0,
      thermalLossCoefficient: parsed.weather?.thermalLossCoefficient ?? 0.15,
      cop: parsed.weather?.cop ?? 3.5,
      cloudPersistence: parsed.weather?.cloudPersistence ?? 0.02,
      winterCloudBias: parsed.weather?.winterCloudBias ?? 0.3,
      summerCloudBias: parsed.weather?.summerCloudBias ?? -0.1,
      enableBaseLoadModulation: parsed.weather?.enableBaseLoadModulation ?? true,
      baseLoadSeasonalVariation: parsed.weather?.baseLoadSeasonalVariation ?? 0.2,
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
    peakShaving: {
      enabled: parsed.peakShaving?.enabled ?? false,
      batteryCapacity_kWh: parsed.peakShaving?.batteryCapacity_kWh ?? 500,
      maxChargePower_kW: parsed.peakShaving?.maxChargePower_kW ?? 250,
      maxDischargePower_kW: parsed.peakShaving?.maxDischargePower_kW ?? 250,
      peakThreshold_kW: parsed.peakShaving?.peakThreshold_kW ?? 120,
      roundTripEfficiency: parsed.peakShaving?.roundTripEfficiency ?? 0.90,
      minSocFraction: parsed.peakShaving?.minSocFraction ?? 0.10,
      maxSocFraction: parsed.peakShaving?.maxSocFraction ?? 0.90,
      initialSocFraction: parsed.peakShaving?.initialSocFraction ?? 0.50,
    },
  };
}

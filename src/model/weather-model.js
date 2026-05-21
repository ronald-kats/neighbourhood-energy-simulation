import { WeatherCondition } from './weather-condition.js';

/**
 * Compute day-of-year (1-indexed, 1 Jan = 1).
 */
function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deterministic weather model using sinusoidal seasonal/diurnal curves
 * plus seeded PRNG for cloud and noise.
 *
 * All formulas follow FR-W3, FR-W4, and FR-W5 from the weather requirements.
 */
export class DeterministicWeatherModel {
  /**
   * @param {object} config — weather section of the parsed config
   * @param {number} stepSizeMinutes — simulation step size
   */
  constructor(config, stepSizeMinutes) {
    this.latitude = config.latitude ?? 52.0;
    this.annualMeanTemperature_C = config.annualMeanTemperature_C ?? 10.0;
    this.annualTemperatureAmplitude_C = config.annualTemperatureAmplitude_C ?? 7.0;
    this.diurnalTemperatureAmplitude_C = config.diurnalTemperatureAmplitude_C ?? 5.0;
    this.temperatureNoiseRange_C = config.temperatureNoiseRange_C ?? 1.5;
    this.cloudPersistence = config.cloudPersistence ?? 0.02;
    this.winterCloudBias = config.winterCloudBias ?? 0.3;
    this.summerCloudBias = config.summerCloudBias ?? -0.1;
    this.stepSizeMinutes = stepSizeMinutes;

    // Stateful: tracks last cloud cover for smooth random walk
    this._lastCloudCover = 0.5;
  }

  /**
   * Compute weather for the given simulation time.
   * @param {Date} dateTime
   * @param {() => number} rng — seeded PRNG returning [0, 1)
   * @returns {WeatherCondition}
   */
  getWeather(dateTime, rng) {
    const season = WeatherCondition.seasonFromDate(dateTime);
    const temperature_C = this._computeTemperature(dateTime, rng);
    const cloudCover = this._computeCloudCover(dateTime, rng);
    const irradianceFactor = this._computeIrradiance(dateTime, cloudCover);

    return new WeatherCondition({
      temperature_C: Math.round(temperature_C * 100) / 100,
      irradianceFactor: Math.round(irradianceFactor * 1000) / 1000,
      cloudCover: Math.round(cloudCover * 1000) / 1000,
      season,
      timestamp: new Date(dateTime),
    });
  }

  /** @private FR-W3.2: sinusoidal annual + diurnal + noise */
  _computeTemperature(dateTime, rng) {
    const doy = dayOfYear(dateTime);
    const hour = dateTime.getHours() + dateTime.getMinutes() / 60.0;

    // Seasonal: peak at day 198 (~17 July), trough at day 15 (~15 Jan)
    const T_seasonal = this.annualTemperatureAmplitude_C *
      Math.sin((2 * Math.PI * (doy - 80)) / 365);

    // Diurnal: peak at 14:00 (hour 14), trough at 04:00
    const T_diurnal = (this.diurnalTemperatureAmplitude_C / 2) *
      Math.sin((2 * Math.PI * (hour - 8)) / 24);

    // Noise: small deterministic jitter from PRNG
    const T_noise = (rng() - 0.5) * 2 * this.temperatureNoiseRange_C;

    return this.annualMeanTemperature_C + T_seasonal + T_diurnal + T_noise;
  }

  /** @private FR-W4: solar elevation angle from declination + hour angle + latitude */
  _computeSolarElevation(dateTime) {
    const doy = dayOfYear(dateTime);
    const hour = dateTime.getHours() + dateTime.getMinutes() / 60.0;

    // Solar declination (degrees)
    const declination = 23.45 * Math.sin((2 * Math.PI * (284 + doy)) / 365);
    const decRad = toRadians(declination);

    // Hour angle: 15 degrees per hour from solar noon
    const hourAngle = 15 * (hour - 12);
    const haRad = toRadians(hourAngle);

    const latRad = toRadians(this.latitude);

    const sinElevation = Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

    return Math.asin(sinElevation); // radians
  }

  /** @private FR-W4.2: clear-sky irradiance attenuated by cloud cover */
  _computeIrradiance(dateTime, cloudCover) {
    const elevRad = this._computeSolarElevation(dateTime);
    if (elevRad <= 0) return 0;

    const sinElevation = Math.sin(elevRad);

    // Sun strength varies slightly with Earth-Sun distance (optional, nominal 1.0)
    const doy = dayOfYear(dateTime);
    const sunStrength = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);

    const clearSkyIrradiance = sinElevation * sunStrength;
    const cloudAttenuation = 1.0 - cloudCover;

    return Math.max(0, clearSkyIrradiance * cloudAttenuation);
  }

  /** @private FR-W5: random walk bounded [0, 1] with seasonal bias via slow mean reversion */
  _computeCloudCover(dateTime, rng) {
    const month = dateTime.getMonth() + 1;
    const minutes = this.stepSizeMinutes;

    // Seasonal bias: winter cloudier, summer clearer
    let seasonalBias = 0;
    if (month === 12 || month === 1 || month === 2) {
      seasonalBias = this.winterCloudBias;
    } else if (month >= 6 && month <= 8) {
      seasonalBias = this.summerCloudBias;
    }

    const targetCloud = clamp(0.5 + seasonalBias, 0.0, 1.0);

    // Random walk step
    const drift = (rng() - 0.5) * 2 * this.cloudPersistence * minutes;

    // Slow mean reversion toward seasonal target (0.0001 per minute)
    const reversionRate = 0.0001;
    const meanReversion = (targetCloud - this._lastCloudCover) * reversionRate * minutes;

    this._lastCloudCover = clamp(this._lastCloudCover + drift + meanReversion, 0.0, 1.0);
    return this._lastCloudCover;
  }
}

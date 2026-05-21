import { SimulationClock } from './clock.js';
import { createRNG } from './rng.js';
import { Neighbourhood } from '../model/neighbourhood.js';

/**
 * SimulationEngine — orchestrates the tick loop.
 * Each tick: advance clock → step all assets → record history → emit state via callback.
 */
export class SimulationEngine {
  constructor(config, onTick) {
    this.stepSizeMinutes = config.simulation.stepSizeMinutes;
    this.speedMultiplier = config.simulation.speedMultiplier;
    this.onTick = onTick; // callback(SimulationState) each tick

    this.clock = new SimulationClock(new Date(config.simulation.startTime));
    this.clock.setSpeed(this.speedMultiplier);
    this.rng = createRNG(config.simulation.seed);
    this.neighbourhood = new Neighbourhood(config);

    this._intervalId = null;
  }

  /** Start the simulation loop. */
  start() {
    this.clock.play();
    this._scheduleTick();
  }

  /** Pause the simulation. */
  pause() {
    this.clock.pause();
    if (this._intervalId) {
      clearTimeout(this._intervalId);
      this._intervalId = null;
    }
  }

  /** Resume after pause. */
  resume() {
    if (!this.clock.isRunning) {
      this.clock.play();
      this._scheduleTick();
    }
  }

  /** Set speed multiplier and reschedule. */
  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
    this.clock.setSpeed(multiplier);
    if (this.clock.isRunning) {
      // Reschedule with new interval
      if (this._intervalId) {
        clearTimeout(this._intervalId);
        this._intervalId = null;
      }
      this._scheduleTick();
    }
  }

  /** Whether the simulation is currently running. */
  get isRunning() {
    return this.clock.isRunning;
  }

  // --- private ---

  _scheduleTick() {
    if (!this.clock.isRunning) return;

    // realIntervalMs = (stepSizeMinutes * 60000) / speedMultiplier
    const intervalMs = Math.max(10, (this.stepSizeMinutes * 60000) / this.speedMultiplier);

    this._intervalId = setTimeout(() => {
      this._tick();
      this._scheduleTick();
    }, intervalMs);
  }

  _tick() {
    const deltaTimeHours = this.stepSizeMinutes / 60;

    // Context for season/time-aware assets
    const context = {
      month: this.clock.month,
      hour: this.clock.hour,
    };

    // Advance the clock
    this.clock.advance(this.stepSizeMinutes);

    // Step the neighbourhood
    this.neighbourhood.step(deltaTimeHours, this.rng, context);
    this.neighbourhood.recordHistory(this.clock.currentTime);

    // Emit state
    const state = this._buildState();
    if (this.onTick) {
      this.onTick(state);
    }
  }

  _buildState() {
    return {
      time: this.clock.toISOString(),
      displayTime: this.clock.toDisplayString(),
      season: this.clock.season,
      speedMultiplier: this.speedMultiplier,
      isRunning: this.clock.isRunning,
      netPower_kW: this.neighbourhood.netPower_kW,
      history: this.neighbourhood.history.map(h => ({
        time: h.time.toISOString(),
        netPower_kW: h.netPower_kW,
      })),
      houses: this.neighbourhood.houses.map(house => ({
        id: house.id,
        netPower_kW: house.netPower_kW,
        assets: house.assets.map(a => ({
          name: a.name,
          currentPower_kW: a.currentPower_kW,
          cumulativeEnergy_kWh: Math.round(a.cumulativeEnergy_kWh * 1000) / 1000,
        })),
      })),
      publicChargers: this.neighbourhood.publicChargers.map(c => ({
        name: c.name,
        currentPower_kW: c.currentPower_kW,
        cumulativeEnergy_kWh: Math.round(c.cumulativeEnergy_kWh * 1000) / 1000,
      })),
    };
  }
}
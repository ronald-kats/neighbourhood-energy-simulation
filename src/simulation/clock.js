/**
 * SimulationClock — manages the simulation timeline.
 * Supports play, pause, and variable speed control.
 */
export class SimulationClock {
  constructor(startTime = new Date('2024-01-01T00:00:00')) {
    this.currentTime = new Date(startTime);
    this.isRunning = false;
    this.speedMultiplier = 60; // 1 real second = 60 simulated minutes
  }

  /** Advance the clock by the given number of minutes. */
  advance(stepSizeMinutes) {
    this.currentTime = new Date(this.currentTime.getTime() + stepSizeMinutes * 60000);
  }

  play() {
    this.isRunning = true;
  }

  pause() {
    this.isRunning = false;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  get month() {
    return this.currentTime.getMonth() + 1; // 1-indexed
  }

  get hour() {
    return this.currentTime.getHours();
  }

  get season() {
    const m = this.month;
    if (m >= 3 && m <= 5) return 'Spring';
    if (m >= 6 && m <= 8) return 'Summer';
    if (m >= 9 && m <= 11) return 'Autumn';
    return 'Winter';
  }

  toISOString() {
    return this.currentTime.toISOString();
  }

  toDisplayString() {
    return this.currentTime.toLocaleString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
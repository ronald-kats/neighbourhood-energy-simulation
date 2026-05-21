import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationClock } from '../src/simulation/clock.js';

describe('SimulationClock', () => {
  it('starts at the given time', () => {
    const clock = new SimulationClock(new Date('2024-06-15T12:00:00'));
    assert.equal(clock.currentTime.toISOString(), new Date('2024-06-15T12:00:00').toISOString());
  });

  it('advances by the given number of minutes', () => {
    const clock = new SimulationClock(new Date('2024-01-01T00:00:00'));
    clock.advance(5);
    assert.equal(clock.currentTime.getMinutes(), 5);
  });

  it('advances hours when minutes overflow', () => {
    const clock = new SimulationClock(new Date('2024-01-01T00:00:00'));
    clock.advance(60);
    assert.equal(clock.currentTime.getHours(), 1);
    assert.equal(clock.currentTime.getMinutes(), 0);
  });

  it('advances days when hours overflow', () => {
    const clock = new SimulationClock(new Date('2024-01-01T23:00:00'));
    clock.advance(120); // 2 hours
    assert.equal(clock.currentTime.getDate(), 2);
    assert.equal(clock.currentTime.getHours(), 1);
  });

  it('starts paused by default', () => {
    const clock = new SimulationClock();
    assert.equal(clock.isRunning, false);
  });

  it('play sets isRunning to true', () => {
    const clock = new SimulationClock();
    clock.play();
    assert.equal(clock.isRunning, true);
  });

  it('pause sets isRunning to false', () => {
    const clock = new SimulationClock();
    clock.play();
    clock.pause();
    assert.equal(clock.isRunning, false);
  });

  it('returns correct season for each month', () => {
    const seasons = {
      '2024-01-15': 'Winter',
      '2024-02-15': 'Winter',
      '2024-03-15': 'Spring',
      '2024-04-15': 'Spring',
      '2024-05-15': 'Spring',
      '2024-06-15': 'Summer',
      '2024-07-15': 'Summer',
      '2024-08-15': 'Summer',
      '2024-09-15': 'Autumn',
      '2024-10-15': 'Autumn',
      '2024-11-15': 'Autumn',
      '2024-12-15': 'Winter',
    };
    for (const [dateStr, expectedSeason] of Object.entries(seasons)) {
      const clock = new SimulationClock(new Date(dateStr));
      assert.equal(clock.season, expectedSeason, `${dateStr} should be ${expectedSeason}`);
    }
  });

  it('speed multiplier defaults to 60', () => {
    const clock = new SimulationClock();
    assert.equal(clock.speedMultiplier, 60);
  });

  it('setSpeed changes the multiplier', () => {
    const clock = new SimulationClock();
    clock.setSpeed(3600);
    assert.equal(clock.speedMultiplier, 3600);
  });
});
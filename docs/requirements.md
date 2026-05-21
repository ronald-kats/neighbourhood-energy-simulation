# Requirements: Neighbourhood Energy Simulation

## Functional Requirements

### FR1: Data Model
1. **FR1.1** — A neighbourhood consists of exactly 30 houses and 6 public EV chargers.
2. **FR1.2** — Each house has exactly one base household consumption asset.
3. **FR1.3** — Each house has exactly one of each optional asset: heat pump, PV panels, and home EV charger.
4. **FR1.4** — Every asset must track:
    - Current power in **kW** (not kWh)
    - Cumulative energy since simulation start in **kWh**
5. **FR1.5** — Each house must have a power consumption limit in **kW** (not kWh).
6. **FR1.6** — Each house's net power must equal the sum of its assets' power at any point in time.
7. **FR1.7** — Public EV chargers are shared infrastructure belonging to the neighbourhood, not to individual houses.

### FR2: Configuration
1. **FR2.1** — The neighbourhood model must be configurable via a YAML file.
2. **FR2.2** — YAML configuration must support:
    - Fixed random seed for reproducibility
    - Power limits per asset type
    - Simulation start date/time
    - Simulation step size
    - Weather model parameters (temperature, irradiance, cloud cover)
    - Optional peak-shaving battery parameters
3. **FR2.3** — System must validate configuration on load and reject invalid configs with clear errors.
    - Implemented: validates presence of `simulation`, `houses`, and `publicChargers` sections. All fields have defaults so individual values are not validated for type/range.

### FR3: Simulation Clock
1. **FR3.1** — Simulation must maintain a controllable clock with simulated date/time.
2. **FR3.2** — Clock must advance in configurable discrete steps (default: 60 minutes).
3. **FR3.3** — Clock must support: play, pause, and speed control (configurable multiplier, UI offers 1h/s, 6h/s, 1d/s, 5d/s).
4. **FR3.4** — Current simulated date/time must be queryable at any point.
5. **FR3.5** — Clock derives a string season (Winter/Spring/Summer/Autumn) from the current month for UI display.

### FR4: Asset Behaviour
1. **FR4.1** — Base household consumption varies with a bounded random walk around a configured base load, modulated by time-of-day (evening bump, night dip) and season (winter increase). Modulation can be disabled in config.
2. **FR4.2** — Heat pump consumption is driven by outdoor temperature: `heatingDemand = max(0, T_indoor - T_outdoor)`, power = `min(heatingDemand * thermalLossCoefficient / COP, maxPower_kW)`. Idles when outdoor >= indoor target.
3. **FR4.3** — PV production is driven by irradiance: `pvPower = -(peakPower_kW * irradianceFactor)`. Zero at night, proportional to solar elevation and reduced by cloud cover.
4. **FR4.4** — EV chargers (home and public) simulate charging sessions: start at random times (Poisson process), run for a random duration, then go idle.
5. **FR4.5** — Public EV chargers must have an independent usage model (random arrivals, not tied to specific houses).
6. **FR4.6** — HeatPump enforces `maxPower_kW` cap. BaseConsumption clamps to `baseLoad ± variance` bounds. PV and EV chargers have no explicit power limit enforcement (their formulas are naturally bounded).
7. **FR4.7** — Assets can be in idle state (current power = 0).

### FR5: Energy Accounting
1. **FR5.1** — Every asset must accurately accumulate energy: `cumulativeEnergy += currentPower * deltaTimeHours`.
2. **FR5.2** — Neighbourhood must track aggregate net power at each time step.
3. **FR5.3** — Neighbourhood must maintain a rolling 24-hour power history. Window size is dynamically computed from step size (`ceil(1440 / stepSizeMinutes)` entries).
4. **FR5.4** — PV production offsets local house load first; excess is exported (negative net load at house level).
5. **FR5.5** — Energy accounting must be consistent: neighbourhood aggregate = sum of all house totals + public charger totals + battery (if enabled).

### FR6: Simulation Reproducibility
1. **FR6.1** — Given the same YAML config (including seed), the simulation must produce identical results.
2. **FR6.2** — All randomness must flow through a single seeded mulberry32 PRNG.
3. **FR6.3** — Peak-shaving controller and battery are purely algorithmic (no randomness), so they do not affect reproducibility.

### FR7: Data Export / State Access
1. **FR7.1** — Current simulation state must be queryable at any time (for UI consumption).
2. **FR7.2** — State must include: current time, season, neighbourhood net power, weather conditions, per-asset cumulative energy, 24-hour power history, and battery status (if enabled).
3. **FR7.3** — State emission is throttled to ~10 fps to keep the UI responsive at high simulation speeds.

### FR8: Peak-Shaving Battery (Optional)
1. **FR8.1** — A neighbourhood-level battery can be enabled via `peakShaving.enabled` in config.
2. **FR8.2** — Battery tracks state of charge (kWh), enforces SoC bounds, power limits, and round-trip efficiency.
3. **FR8.3** — `PeakShavingController` computes target battery power each step using four priority-ordered rules:
    1. Discharge to shave peaks above `peakThreshold_kW`
    2. Charge from excess solar generation (negative net power)
    3. Gentle charge toward target SoC midpoint (25% of max rate) when below target
    4. Idle otherwise
4. **FR8.4** — Round-trip efficiency is applied symmetrically: `sqrt(efficiency)` loss per charge/discharge direction.

---

## Non-Functional Requirements

### NFR1: Code Quality
1. **NFR1.1** — Clear separation of concerns: domain model, simulation engine, configuration, and UI must be in separate modules.
2. **NFR1.2** — Asset types must be extensible (adding a new asset type should not require modifying existing asset code).
3. **NFR1.3** — Code must be readable and follow consistent naming conventions.

### NFR2: Performance
1. **NFR2.1** — Simulation must run at least 60x real-time on modern hardware (1 simulated hour per wall-clock second) to enable practical UI demonstration.
2. **NFR2.2** — Memory usage must not grow unbounded (power history limited to 24h retention).
3. **NFR2.3** — Weather computation per step is O(1).

### NFR3: Correctness
1. **NFR3.1** — Energy accounting must be verified by automated tests.
2. **NFR3.2** — Cumulative energy values must be monotonic for consumption assets.
3. **NFR3.3** — Test coverage for core simulation logic (clock, assets, accounting, weather, reproducibility).

### NFR4: Determinism
1. **NFR4.1** — Fixed seed must produce identical simulation runs.
2. **NFR4.2** — All stochastic behaviour must be seed-dependent.

### NFR5: Extensibility
1. **NFR5.1** — Asset `step()` signature accepts `(deltaTimeHours, weather, rng)` — weather and PRNG are injected, so new asset types have access to both without signature changes.
2. **NFR5.2** — The weather model is swappable via duck typing (any object with `getWeather(date, rng) -> WeatherCondition` works).

---

## Implemented: Weather and Season

Weather and season were initially deferred (see git history) and are now fully implemented. See `docs/weather-requirements.md` for detailed specifications.

Summary of implemented weather features:
- `Season` enum (`WINTER`, `SPRING`, `SUMMER`, `AUTUMN`) derived from month
- `WeatherCondition` value object: `temperature_C`, `irradianceFactor`, `cloudCover`, `season`, `timestamp`
- `DeterministicWeatherModel`: sinusoidal annual + diurnal temperature curves with PRNG noise; solar geometry irradiance attenuated by cloud cover; cloud cover as bounded random walk with seasonal bias and mean reversion
- PV production responds to `irradianceFactor`
- Heat pump consumption responds to `temperature_C`
- Base load modulation responds to time-of-day and season (configurable, can be disabled)

---

## Issues Found in Original Requirements

### 1. Unit Error: Power vs Energy — Fixed
- **Original**: "Current power in kWh" and "Power limit in kWh"
- **Problem**: kWh is a unit of energy, not power. Power is measured in kW.
- **Fix**: Changed to use kW for current power and power limits, kWh for cumulative energy.

### 2. "Household consumption matches or exceeds assets" — Clarified
- **Original**: "Household consumption and production always matches or exceeds consumption and production of its assets"
- **Resolution**: The base household consumption asset acts as a catch-all for unmodeled loads: ovens, dishwashers, lighting, electronics, etc. House net power includes the always-present non-negative base load.
- **Formula**: `house.netPower = baseLoad.power + heatPump.power + evCharger.power - pv.power`

### 3. Public EV Charger Usage Model Not Defined — Resolved
- **Problem**: The assignment states "you define your usage model, but document it" — but the requirements don't even mention that this needs defining.
- **Resolution**: Implemented as a Poisson process: session start probability = `sessionsPerDay / 24 * deltaTimeHours`, random duration around `avgSessionDurationHours`.

### 4. Weather Model Underspecified — Resolved
- **Problem**: Requirements said "at least one variable" but didn't specify minimum behaviour.
- **Resolution**: Fully implemented with temperature, irradiance, and cloud cover models. See `docs/weather-requirements.md`.

### 5. PV Export Model Not Defined — Resolved
- **Problem**: Requirements said "Define whether PV offsets local load, exports to grid, etc." but the core requirements didn't specify this.
- **Resolution**: PV offsets local load first, excess is exported as negative net load at house level.

### 6. No Simulation Start Defined — Fixed
- **Problem**: No specification of when the simulation starts.
- **Resolution**: Added configurable start date/time to configuration.

### 7. No Speed Control Specification — Fixed
- **Problem**: Assignment mentions "controllable simulation clock" but requirements don't specify controls.
- **Resolution**: Added play, pause, and speed control to the simulation engine and UI.

### 8. "Current Date/Time" Without Start Reference — Fixed
- **Problem**: Requirements mention tracking "simulated date/time" but not when it begins.
- **Resolution**: Added configurable start date/time.

### 9. Missing Reproducibility Requirement — Fixed
- **Problem**: The assignment requires deterministic simulation but the requirements document doesn't state this.
- **Resolution**: Added fixed random seed and reproducibility guarantee.

### 10. Asset Counting Ambiguity — Resolved
- **Problem**: "Heat pump (optional, consumes power, multiple possible)" — "multiple" is unclear.
- **Resolution**: Each house has exactly one of each asset type (BaseConsumption, HeatPump, PV, HomeEvCharger). No distribution ratios — every house gets all asset types.

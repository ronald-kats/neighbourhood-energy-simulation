# Requirements: Neighbourhood Energy Simulation

## Functional Requirements

### FR1: Data Model
1. **FR1.1** — A neighbourhood consists of exactly 30 houses and 6 public EV chargers.
2. **FR1.2** — Each house has exactly one base household consumption asset.
3. **FR1.3** — Each house may have zero or more optional assets: heat pump(s), PV panel(s), home EV charger(s).
4. **FR1.4** — Every asset must track:
    - Current power in **kW** (not kWh)
    - Cumulative energy since simulation start in **kWh**
    - Power limit (capacity) in **kW**
5. **FR1.5** — Each house must have a power consumption limit in **kW** (not kWh).
6. **FR1.6** — Each house's total consumption must equal the sum of its assets' consumption at any point in time.
7. **FR1.7** — Public EV chargers are shared infrastructure belonging to the neighbourhood, not to individual houses.

### FR2: Configuration
1. **FR2.1** — The neighbourhood model must be configurable via a YAML file.
2. **FR2.2** — YAML configuration must support:
    - Fixed random seed for reproducibility
    - Proportions/ratios for asset distribution (PV, heat pump, home EV)
    - Power limits per asset type
    - Simulation start date/time
    - Simulation step size
3. **FR2.3** — System must validate configuration on load and reject invalid configs with clear errors.

### FR3: Simulation Clock
1. **FR3.1** — Simulation must maintain a controllable clock with simulated date/time.
2. **FR3.2** — Clock must advance in configurable discrete steps (default: 1 minute).
3. **FR3.3** — Clock must support: play, pause, and speed control (e.g., 1x, 10x, 60x, 3600x real-time).
4. **FR3.4** — Current simulated date/time must be queryable at any point.

### FR4: Asset Behaviour
1. **FR4.1** — Base household consumption must vary randomly around a configured base load within its power limit.
2. **FR4.2** — Heat pump consumption must vary randomly within its power limit (weather influence deferred).
3. **FR4.3** — PV production must vary randomly within its power limit (weather/irradiance influence deferred).
4. **FR4.4** — EV chargers (home and public) must simulate charging sessions: start at random times, run for a duration, then go idle.
5. **FR4.5** — Public EV chargers must have an independent usage model (random arrivals, not tied to specific houses).
6. **FR4.6** — Assets must respect their configured power limits (0 <= |power| <= limit).
7. **FR4.7** — Assets can be in idle state (current power = 0).

### FR5: Energy Accounting
1. **FR5.1** — Every asset must accurately accumulate energy: `cumulativeEnergy += currentPower * deltaTimeHours`.
2. **FR5.2** — Neighbourhood must track aggregate net power at each time step.
3. **FR5.3** — Neighbourhood must maintain a rolling 24-hour power history.
4. **FR5.4** — PV production offsets local house load first; excess is exported (negative net load at house level).
5. **FR5.5** — Energy accounting must be consistent: neighbourhood aggregate = sum of all house totals + public charger totals.

### FR6: Simulation Reproducibility
1. **FR6.1** — Given the same YAML config (including seed), the simulation must produce identical results.
2. **FR6.2** — All randomness must flow through a single seeded PRNG.

### FR7: Data Export / State Access
1. **FR7.1** — Current simulation state must be queryable at any time (for UI consumption).
2. **FR7.2** — State must include: current time, neighbourhood net power, and per-asset cumulative energy.

---

## Non-Functional Requirements

### NFR1: Code Quality
1. **NFR1.1** — Clear separation of concerns: domain model, simulation engine, configuration, and UI must be in separate modules.
2. **NFR1.2** — Asset types must be extensible (adding a new asset type should not require modifying existing asset code).
3. **NFR1.3** — Code must be readable and follow consistent naming conventions.

### NFR2: Performance
1. **NFR2.1** — Simulation must run at least 60x real-time on modern hardware (1 simulated hour per wall-clock second) to enable practical UI demonstration.
2. **NFR2.2** — Memory usage must not grow unbounded (power history limited to 24h retention).

### NFR3: Correctness
1. **NFR3.1** — Energy accounting must be verified by automated tests.
2. **NFR3.2** — Cumulative energy values must be monotonic for consumption and production assets.
3. **NFR3.3** — Test coverage for core simulation logic (clock, assets, accounting).

### NFR4: Determinism
1. **NFR4.1** — Fixed seed must produce identical simulation runs.
2. **NFR4.2** — All stochastic behaviour must be seed-dependent.

### NFR5: Extensibility
1. **NFR5.1** — Asset `step()` signature must accommodate a future `Weather` parameter without breaking existing assets.
2. **NFR5.2** — Simulation engine must accommodate a future weather update step without restructuring the main loop.

---

## Deferred: Weather and Season

Weather and season are intentionally deferred to a later phase. When added:
- A `Weather` class will provide `temperature_C` and `irradianceFactor` derived from the simulated date/time
- Season will be derived from the date (spring/summer/autumn/winter)
- `Asset.step(deltaHours)` will become `Asset.step(deltaHours, weather)`
- PV production will respond to irradiance
- Heat pump consumption will respond to temperature
- Base load will respond to time-of-day and season

Current asset behaviour uses simple random variation within limits as a stand-in.

---

## Issues Found in Original Requirements

### 1. Unit Error: Power vs Energy — Fixed
- **Original**: "Current power in kWh" and "Power limit in kWh"
- **Problem**: kWh is a unit of energy, not power. Power is measured in kW.
- **Fix**: Changed `Requirements.md` to use kW for current power and power limits, kWh for cumulative energy.

### 2. "Household consumption matches or exceeds assets" — Clarified
- **Original**: "Household consumption and production always matches or exceeds consumption and production of its assets"
- **Resolution**: The base household consumption asset acts as a catch-all for unmodeled loads: ovens, dishwashers, lighting, electronics, etc. This is why house total consumption will always *equal or exceed* the sum of the explicitly modeled optional assets (heat pump, EV charger).
- **Formula**: `House.totalConsumption = baseLoad.power + sum(heatPumps) + sum(evChargers) - sum(pv)` where baseLoad is always present and non-negative, guaranteeing house total >= sum of optional explicit assets.

### 3. Public EV Charger Usage Model Not Defined (Medium)
- **Problem**: The assignment states "you define your usage model, but document it" — but the requirements don't even mention that this needs defining.
- **Resolution**: Added FR4.5 requiring an independent usage model with random arrivals.

### 4. Weather Model Underspecified — Deferred
- **Problem**: Requirements say "at least one variable" but don't specify minimum behaviour.
- **Resolution**: Weather and season deferred to later phase. Current assets use random variation. See "Deferred: Weather and Season" section.

### 5. PV Export Model Not Defined (Medium)
- **Problem**: Requirements say "Define whether PV offsets local load, exports to grid, etc." but the core requirements don't specify this.
- **Resolution**: Added FR5.4: PV offsets local load first, excess is exported as negative net load.

### 6. No Simulation Start Defined — Fixed
- **Problem**: No specification of when the simulation starts.
- **Resolution**: Added configurable start date/time to `Requirements.md` configuration section.

### 7. No Speed Control Specification — Fixed
- **Problem**: Assignment mentions "controllable simulation clock" but requirements don't specify controls.
- **Resolution**: Added play, pause, and speed control to `Requirements.md` core simulation model.

### 8. "Current Date/Time" Without Start Reference — Fixed
- **Problem**: Requirements mention tracking "simulated date/time" but not when it begins.
- **Resolution**: Added "configurable start date/time" to clock description in `Requirements.md`.

### 9. Missing Reproducibility Requirement — Fixed
- **Problem**: The assignment requires deterministic simulation but the requirements document doesn't state this.
- **Resolution**: Added fixed random seed and reproducibility guarantee to `Requirements.md` configuration and simulator sections.

### 10. Asset Counting Ambiguity (Low)
- **Problem**: "Heat pump (optional, consumes power, multiple possible)" — "multiple" is unclear. Can a house have 2 heat pumps? 10?
- **Resolution**: Model supports zero or more of each optional asset type; configuration defines the distribution.
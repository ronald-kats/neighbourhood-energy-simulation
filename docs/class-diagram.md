# Class Diagram: Neighbourhood Energy Simulation

```mermaid
classDiagram
    direction TB

    %% ── Weather & Season ───────────────────────────────────

    class Season {
        <<enumeration>>
        WINTER
        SPRING
        SUMMER
        AUTUMN
        +fromMonth(int month) Season$
    }

    class WeatherCondition {
        <<value object>>
        +double temperature_C
        +double irradianceFactor
        +double cloudCover
        +Season season
        +Date timestamp
        +seasonFromDate(Date) Season$
    }

    class DeterministicWeatherModel {
        -double latitude
        -double annualMeanTemperature_C
        -double annualTemperatureAmplitude_C
        -double diurnalTemperatureAmplitude_C
        -double temperatureNoiseRange_C
        -double cloudPersistence
        -double winterCloudBias
        -double summerCloudBias
        -double _lastCloudCover
        +getWeather(Date, Random) WeatherCondition
        -_computeTemperature(Date, Random) double
        -_computeSolarElevation(Date) double
        -_computeIrradiance(Date, double) double
        -_computeCloudCover(Date, Random) double
    }

    %% ── Asset hierarchy ────────────────────────────────────

    class Asset {
        <<abstract>>
        +String name
        +double currentPower_kW
        +double cumulativeEnergy_kWh
        +step(double deltaHours, WeatherCondition weather, Random rng)* void
        +updateEnergy(double power, double deltaHours) void
    }

    class BaseConsumption {
        +double baseLoad_kW
        +double variance_kW
        +boolean enableModulation
        +double seasonalVariation
        +step(double deltaHours, WeatherCondition weather, Random rng) void
    }

    class HeatPump {
        +double maxPower_kW
        +double indoorTargetTemp
        +double thermalLossCoefficient
        +double cop
        +step(double deltaHours, WeatherCondition weather, Random rng) void
    }

    class PV {
        +double peakPower_kW
        +step(double deltaHours, WeatherCondition weather, Random rng) void
    }

    class HomeEvCharger {
        +double chargePower_kW
        +double sessionsPerDay
        +double avgSessionDurationHours
        -double _sessionRemainingHours
        +step(double deltaHours, WeatherCondition weather, Random rng) void
    }

    class PublicEvCharger {
        +double chargePower_kW
        +double sessionsPerDay
        +double avgSessionDurationHours
        -double _sessionRemainingHours
        +step(double deltaHours, WeatherCondition weather, Random rng) void
    }

    %% ── Composition ────────────────────────────────────────

    class House {
        +int id
        +double powerLimit_kW
        +List~Asset~ assets
        +double netPower_kW
        +step(double deltaHours, WeatherCondition weather, Random rng) void
    }

    class Neighbourhood {
        +List~House~ houses
        +List~PublicEvCharger~ publicChargers
        +List~HistoryEntry~ history
        +double netPower_kW
        +step(double deltaHours, WeatherCondition weather, Random rng) void
        +recordHistory(Date clockTime) void
    }

    %% ── Engine & Server ────────────────────────────────────

    class SimulationClock {
        +Date currentTime
        +boolean isRunning
        +int speedMultiplier
        +int month
        +int hour
        +String season
        +advance(int minutes) void
        +play() void
        +pause() void
        +setSpeed(int multiplier) void
    }

    class SimulationEngine {
        +int stepSizeMinutes
        +int speedMultiplier
        +SimulationClock clock
        +Neighbourhood neighbourhood
        +DeterministicWeatherModel weatherModel
        +onTick(callback)
        +start() void
        +pause() void
        +resume() void
        +setSpeed(int multiplier) void
        -_tick() void
        -_scheduleTick() void
        -_buildState() SimulationState
    }

    class SimulationState {
        +String time
        +String displayTime
        +String season
        +int speedMultiplier
        +boolean isRunning
        +double netPower_kW
        +WeatherCondition currentWeather
        +List~HistoryEntry~ history
        +List~HouseState~ houses
        +List~ChargerState~ publicChargers
    }

    %% ── Inheritance ────────────────────────────────────────

    Asset <|-- BaseConsumption
    Asset <|-- HeatPump
    Asset <|-- PV
    Asset <|-- HomeEvCharger
    Asset <|-- PublicEvCharger

    %% ── Relationships ──────────────────────────────────────

    Neighbourhood "1" *-- "30" House
    Neighbourhood "1" *-- "6" PublicEvCharger
    House "1" *-- "4" Asset : (BaseConsumption, HeatPump, PV, HomeEvCharger)

    SimulationEngine --> Neighbourhood
    SimulationEngine --> SimulationClock
    SimulationEngine --> DeterministicWeatherModel
    SimulationEngine ..> SimulationState : emits via onTick

    DeterministicWeatherModel ..> WeatherCondition : creates
    WeatherCondition --> Season : uses
    SimulationClock ..> Season : derives string season

    Asset ..> WeatherCondition : receives in step()
    PV ..> WeatherCondition : reads irradianceFactor
    HeatPump ..> WeatherCondition : reads temperature_C
    BaseConsumption ..> WeatherCondition : reads season, timestamp
```

## Key Design Decisions

### Inheritance over composition for assets
Each asset type extends a base `Asset` class because they share common accounting (power, cumulative energy) but have fundamentally different `step()` behaviour influenced by time, weather, and internal state.

### Asset.step() signature: `step(deltaTimeHours, weather, rng)`
Assets receive three parameters each tick:
- **`deltaTimeHours`** — the simulation step size in hours, for energy accounting
- **`weather`** — a `WeatherCondition` value object with temperature, irradiance, cloud cover, and season. Assets that don't respond to weather (e.g. EV chargers) simply ignore it.
- **`rng`** — the seeded PRNG function, for deterministic stochastic behaviour

This was designed from the start to accommodate weather (NFR5.1, NFR5.2).

### SimulationEngine tick sequence
Each tick the engine:
1. Advances the `SimulationClock` by `stepSizeMinutes`
2. Computes weather: `weatherModel.getWeather(clock.currentTime, rng)`
3. Steps the neighbourhood: recursively steps all houses (each steps its 4 assets) and public chargers
4. Records aggregate power history (rolling 24-hour window)
5. Builds and emits `SimulationState` via the `onTick` callback

### Public EV chargers at neighbourhood level
Public chargers belong to the neighbourhood (not houses) because they are shared infrastructure. Their usage model simulates independent random vehicle arrivals/departures.

### Base consumption as catch-all
`BaseConsumption` models all unmodeled household loads: ovens, lighting, electronics, dishwashers, etc. It is always present and non-negative, which guarantees that a house's total consumption always equals or exceeds the sum of its explicitly modeled assets (heat pump, EV charger) minus PV generation.

```
house.netPower = baseLoad.power + heatPump.power + evCharger.power - pv.power
                 \________ always-present base load ________/  \_ generation _/
```

### Weather model: deterministic, sinusoidal + PRNG noise
The `DeterministicWeatherModel` generates weather from the simulated date/time and the seeded PRNG — no external APIs. Temperature uses a sinusoidal annual curve (peak July, trough January) plus a diurnal curve (peak 14:00, trough 04:00) plus small PRNG noise. Irradiance uses solar geometry (declination, hour angle, latitude) attenuated by cloud cover. Cloud cover is a bounded random walk with seasonal bias and mean reversion.

### Seeded PRNG for full reproducibility
All randomness flows through a single seeded mulberry32 PRNG. The same seed + config + start time always produces identical results — simulation state, weather, and asset behaviour are fully deterministic.

### Server/UI: callback-based decoupling
The HTTP server (`server.js`) receives state via the engine's `onTick` callback and broadcasts to SSE clients. The engine has no knowledge of HTTP, SSE, or the browser. The server wraps the `onTick` callback — it does not import or depend on simulation internals beyond the `SimulationState` shape.

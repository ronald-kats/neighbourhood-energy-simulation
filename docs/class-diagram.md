# Class Diagram: Neighbourhood Energy Simulation

```mermaid
classDiagram
    direction TB

    class Neighbourhood {
        +String name
        +List~House~ houses
        +List~PublicEVCharger~ publicChargers
        +getAggregatePower() double
        +getAggregateCumulativeEnergy() double
        +getPowerHistory() List~PowerRecord~
        +addHouse(House)
        +addPublicCharger(PublicEVCharger)
    }

    class House {
        +String id
        +double powerLimit_kW
        +List~Asset~ assets
        +getCurrentPower() double
        +getCumulativeEnergy() double
        +addAsset(Asset)
    }

    class Asset {
        <<abstract>>
        +String id
        +String type
        +double currentPower_kW
        +double cumulativeEnergy_kWh
        +double powerLimit_kW
        +boolean isIdle
        +step(double deltaHours) void
        +reset()
    }

    class BaseHouseholdConsumption {
        +double baseLoad_kW
        +double varianceFactor
        +step(double deltaHours) void
    }

    class HeatPump {
        +double cop
        +double thermalPower_kW
        +step(double deltaHours) void
    }

    class PV {
        +double peakPower_kWp
        +step(double deltaHours) void
    }

    class HomeEVCharger {
        +double chargePower_kW
        +double sessionEnergy_kWh
        +double sessionRemaining_kWh
        +step(double deltaHours) void
    }

    class PublicEVCharger {
        +double chargePower_kW
        +double sessionEnergy_kWh
        +double sessionRemaining_kWh
        +boolean inUse
        +step(double deltaHours) void
    }

    class SimulationClock {
        +DateTime currentTime
        +DateTime startTime
        +double stepSizeMinutes
        +double speedMultiplier
        +boolean isRunning
        +tick() DateTime
        +pause()
        +resume()
        +setSpeed(double multiplier)
    }

    class SimulationEngine {
        +Neighbourhood neighbourhood
        +SimulationClock clock
        +Random rng
        +long seed
        +run()
        +pause()
        +stepOnce()
        +getState() SimulationState
    }

    class Configuration {
        +int numHouses
        +int numPublicChargers
        +double pvRatio
        +double heatPumpRatio
        +double homeEVRatio
        +long randomSeed
        +DateTime startDate
        +double stepSizeMinutes
        +Map~String, Object~ assetDefaults
        +loadFromYaml(String path) Configuration$
    }

    class PowerRecord {
        +DateTime timestamp
        +double totalConsumption_kW
        +double totalProduction_kW
        +double netPower_kW
    }

    class SimulationState {
        +DateTime currentTime
        +double neighbourhoodNetPower_kW
        +Map~String, Double~ assetCumulativeEnergy
        +List~PowerRecord~ powerHistory24h
    }

    Neighbourhood "1" *-- "30" House
    Neighbourhood "1" *-- "6" PublicEVCharger
    House "1" *-- "1" BaseHouseholdConsumption
    House "1" *-- "0..*" HeatPump
    House "1" *-- "0..*" PV
    House "1" *-- "0..*" HomeEVCharger

    Asset <|-- BaseHouseholdConsumption
    Asset <|-- HeatPump
    Asset <|-- PV
    Asset <|-- HomeEVCharger
    Asset <|-- PublicEVCharger

    SimulationEngine --> Neighbourhood
    SimulationEngine --> SimulationClock
    SimulationEngine --> Configuration
    SimulationEngine --> SimulationState

    Neighbourhood --> PowerRecord
```

## Key Design Decisions

### Inheritance over composition for assets
Each asset type extends a base `Asset` class because they share common accounting (power, cumulative energy, limits) but have fundamentally different `step()` behaviour influenced by time and internal state.

### Time-only step signature (weather deferred)
The `step(deltaHours)` signature keeps assets decoupled from weather for now. Weather and season influence will be added later — when introduced, assets will receive a `Weather` object in their `step()` call. This is a deliberate deferral, not a design limitation.

### SimulationEngine as orchestrator
The engine owns the clock and neighbourhood. Each tick it:
1. Advances the clock
2. Steps all assets across all houses and public chargers
3. Records aggregate power history
4. Publishes updated `SimulationState`

When weather is added later, step 1.5 will be "update weather from clock time".

### Public EV chargers at neighbourhood level
Public chargers belong to the neighbourhood (not houses) because they are shared infrastructure. Their usage model simulates random arrivals/departures of vehicles.

### Base household consumption as catch-all
The `BaseHouseholdConsumption` asset models *all* unmodeled household loads: ovens, lighting, electronics, dishwashers, etc. This is why a house's total consumption always equals or exceeds the sum of its explicitly modeled optional assets (heat pump, EV charger) — the base load is always present and non-negative.

```text
house.totalPower = baseLoad.power + heatPump.power + evCharger.power - pv.power
                                  \________ explicit optional assets ________/
```
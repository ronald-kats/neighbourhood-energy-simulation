# Requirements Neighbourhood Energy Simulation


## Data structure
* A neighbourhood consists of houses
* Houses have energy assets
* Possible energy assets are:
    * Base household consumption (required, one per house)
    * Heat pump (optional, consumes power, multiple possible)
    * PV (optional, produces power, multiple possible)
    * Home EV charger (optional, consumes power, multiple possible)
    * Public EV charger (optional, consumes power, multiple possible)
* Assets have a meter to measure kWh
* Every asset should track:
    * Current power in kW
    * Total cumulative energy in kWh since simulation start
    * Power limit in kW for production or consumption
* Houses should have a power consumption limit in kW

## Configuration
* Use a yaml file for configuring the simulation model
* It should include the structure of the neighbourhood, its houses and assets (see data structure)
* Respect the requirements of the assignment: simulate 30 houses, 6 public EV chargers
* Every asset should have configurable power limits
* Include a configurable simulation start date/time
* Include a fixed random seed for reproducible simulation runs

## Simulator
* Randomly simulate energy consumption and production of the assets respecting the power limits
* All randomness must use a single seeded PRNG to guarantee reproducibility
* Same seed + same config must produce identical simulation results

## Core simulation model
* Controllable simulation clock with configurable start date/time
* Keep track of simulated date/time
* Make use of an internal timed loop for the simulation with timed steps of 1 minute
* Clock must support play, pause, and speed control (e.g., 1x, 10x, 60x real-time)
* Support assets:
    * Base household consumption
    * Heat pump
    * PV
    * Home EV charger
    * Public EV charger
* Every asset should track cumulative energy since simulation start in kWh
* Neighbourhood should track aggregate power/energy over time
* Public chargers can be used for general use, so everyone can use it
* Assets can be idle
* Household consumption and production always matches or exceeds consumption and production of its assets respecting the power limits
* It should be possible to move time back and forward

## Constraints
* Respect SOLID principles
* Clear object and file structure
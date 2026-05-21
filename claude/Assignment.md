# Goal

Build a small, end-to-end system that simulates electricity use and generation in a neighbourhood and visualizes what is happening over time. The focus is on software engineering quality and system design: clear domain modeling, correctness, extensibility, and a usable visualization.

You are free to choose your tech stack and architecture, but you must be able to run the result locally.

# Scenario

Simulate a neighbourhood with:

* 30 houses
    * Some houses have a heat pump
    * Some houses have PV (solar panels)
    * Some houses have a home EV charger
    * Houses may have multiple assets (e.g., PV + heat pump).
* 6 public EV chargers
    * Shared infrastructure used by neighbourhood residents and/or general use (you define your usage model, but document it).

The simulation should evolve over time and allow the user to understand:
* What time/date it is in the simulation
* Weather/season context
* Current and historical neighbourhood load
* Cumulative energy usage/generation per “asset” / meter since simulation start

# Requirements

1) Core simulation model

Implement a time-based simulation with at least:

* Time and date
    * The simulation must have a controllable “simulation clock”.
    * It must be clear what the current simulated date/time is.
    * You may choose the step size (e.g., 1 minute / 5 minutes / 15 minutes), but explain why.
* Assets
    * Houses and public chargers should be represented in a structured, extensible way.
    * At minimum, support these asset types:
        * Base household consumption (always present)
        * Heat pump (optional)
        * PV panels (optional; generates power)
        * Home EV charger (optional)
        * Public EV charger (6 total)
* Energy accounting
    * For every asset (and/or meter), track cumulative energy since simulation start (kWh).
    * Track neighbourhood aggregate power/energy over time.
    * Define whether PV offsets local load, exports to grid, etc. (document your assumptions).

2) Weather and season

The simulation must include a representation of:

privacy friendly and deterministic is fine; real weather APIs are not required.

* Weather (at least one variable such as cloudiness, irradiance factor, or temperature)
* Season (at least winter/spring/summer/autumn or month-based)
Weather/season must influence at least:
* PV production (e.g., irradiance/cloud factor and/or seasonality)
* Heat pump consumption (e.g., temperature-driven demand)

3) Animated visualization / UI

Provide an animated simulation view (i.e., time advances automatically and the UI updates). The UI must show:

* Current simulated date/time
* Weather and season
* Current overall neighbourhood power (kW) and/or energy flow
* A chart showing at least the last 24 hours of neighbourhood energy usage (or net load).
* If your simulation runs faster than real time, the chart still must represent the last 24 simulated hours.
* For each asset or meter:
* Total energy (kWh) since start of simulation
You may choose how to visualize the neighbourhood (map/grid/list/cards). The key is clarity.

4) Configuration

The system must allow the neighbourhood to be defined in a configurable way, e.g.:

* A fixed seed random generator + stated proportions
* A configuration file (JSON/YAML)
* Code-based configuration
At minimum:

* Exactly 30 houses
* Exactly 6 public chargers
* A documented distribution of assets across houses (e.g., 40% PV, 30% heat pumps, 20% home EV).

5) Quality expectations

Within 4 hours, prioritize:

* Readable, maintainable structure
* Clear domain modeling (houses/assets/meters/time/weather)
* Basic tests for core logic (even a few targeted ones)
* Documentation

# Deliverables

Provide:

1. Running application
* Instructions to run locally (README)
* Prefer one-command startup if feasible
2. Source code
* Clean structure
* Reasonable commit history is a plus (not required)
3. Documentation
* Short design overview:
    * Key components and responsibilities
    * Data model
    * Assumptions (especially for EV charging behavior, PV usage/export, heat pump model)
* Any known limitations and what you would improve next
4. (Optional) Tests
* Focus on simulation correctness and energy accounting

# Suggested scope (to help you finish)

If you run out of time, prioritize in this order:

1. Correct simulation + energy accounting + clock
2. Animated UI with neighbourhood aggregate + 24h chart
3. Per-asset cumulative energy counters
4. Weather/season influence
5. Evaluation criteria
 
# You will be assessed on:

* System design: modularity, separation of concerns, extensibility
* Correctness: time progression, energy calculations, accounting consistency
* Code quality: readability, naming, structure, pragmatic patterns
* Product thinking: clarity of visualization and controls, sensible defaults
* Communication: assumptions, documentation, and tradeoffs

# Notes / Assumptions

* You may use simplified models; realism is less important than correctness and clarity.
* No external services are required.
* Use any libraries/frameworks you want, but keep setup reasonable.
* The simulation must be deterministic or at least reproducible (e.g., via a fixed random seed).
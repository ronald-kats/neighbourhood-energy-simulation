# neighbourhood-energy-simulation

Prototype Node.js simulation of electricity use and generation in a neighbourhood with 30 houses and 6 public EV chargers.

## Quick Start

```bash
npm install
npm start
```

Opens the simulation at [http://localhost:3000](http://localhost:3000) with a live animated dashboard.

## Features

- **Deterministic**: Seeded PRNG (mulberry32) ensures identical results with the same seed and config
- **Configurable**: All simulation parameters in `config.yaml`
- **Real-time UI**: Browser dashboard with Chart.js line chart, live gauge, and per-asset breakdown
- **SSE-based**: Server-Sent Events push updates to the browser — no polling, no WebSocket dependencies
- **Zero framework**: Pure Node.js `http` module; one npm dependency (`js-yaml` for config parsing)

## Configuration

Edit `config.yaml` to customise the simulation:

```yaml
simulation:
  stepSizeMinutes: 1      # Granularity of each simulation tick
  seed: 12345             # PRNG seed (same seed = same results)
  speedMultiplier: 60     # 60 = 1 simulated minute per real second

houses:
  count: 30
  powerLimit_kW: 10
  assets:
    baseConsumption: { baseLoad_kW: 0.5, variance_kW: 0.2 }
    heatPump: { maxPower_kW: 3 }
    pv: { peakPower_kW: 5 }
    homeEvCharger: { chargePower_kW: 7, sessionsPerDay: 2, avgSessionDurationHours: 2 }

publicChargers:
  count: 6
  chargePower_kW: 22
  sessionsPerDay: 10
  avgSessionDurationHours: 1
```

### CLI Options

```bash
node src/index.js --config my-config.yaml --port 8080
```

## UI Controls

- **Play/Pause** — start and stop the simulation clock
- **Speed buttons** — 1x, 60x, 3600x (3600x = ~1 simulated hour per real second)

The dashboard shows:

- Current simulation date/time and season
- Neighbourhood net power gauge (green = generation, red = consumption)
- 24-hour net power line chart
- Scrollable per-house asset list with per-asset power and cumulative energy

## Asset Models

Each house contains four assets:

| Asset | Behaviour |
|---|---|
| Base Consumption | Random walk around `baseLoad_kW` ± `variance_kW` |
| Heat Pump | Random consumption scaled by season (higher in winter) |
| Solar PV | Generation based on time-of-day sine curve + seasonal factor + random cloud cover |
| Home EV Charger | Random session start/stop at constant charge power |

Public EV chargers operate independently with higher power and more frequent sessions.

## Testing

```bash
npm test
```

Uses Node.js built-in `node:test` runner. Three test suites:

- **Clock** — time advancement, play/pause, seasons, speed control
- **Energy Accounting** — cumulative energy accumulation, asset bounds, seasonal behaviour
- **Reproducibility** — same seed produces identical results, different seeds diverge

## Project Structure

```
neighbourhood-energy-simulation/
├── package.json
├── config.yaml
├── README.md
├── src/
│   ├── index.js
│   ├── server.js
│   ├── simulation/
│   │   ├── clock.js
│   │   ├── engine.js
│   │   └── rng.js
│   ├── model/
│   │   ├── asset.js
│   │   ├── base-consumption.js
│   │   ├── heat-pump.js
│   │   ├── pv.js
│   │   ├── home-ev-charger.js
│   │   ├── public-ev-charger.js
│   │   ├── house.js
│   │   └── neighbourhood.js
│   ├── config/
│   │   └── loader.js
│   └── ui/
│       └── index.html
└── test/
    ├── clock.test.js
    ├── energy-accounting.test.js
    └── reproducibility.test.js
```

## Dependencies

- **Runtime**: [js-yaml](https://www.npmjs.com/package/js-yaml) (YAML config parsing)
- **Browser**: [Chart.js 4.4](https://www.chartjs.org/) (loaded via CDN)
- **No other npm or runtime dependencies**

## Requirements
- Can be found in docs subfolder:
  - requirements.md: all requirements from assignment
  - weather-requirements: additional requirements for seasonal effects
  - peak-shaving.md: additional peak-shaving requirements

## Known limitations:
- Simple model with randomized values: 
- It should have ability to run realistic scripts
- Using external data for values instead of random values, preferably from API’s with real time data or realistic data sets
- Connect to weather API’s for realistic weather simulation
- More complex logic needed for simulation
- Neighbourhood model’s layout is simple, normally more complex configurations. This should be possible to configure as well
- Only one configuration from yaml file, not very user friendly
- Speed control should be more advanced so you can simulate a day in small steps but also seasons in bigger steps
- The current setup with a list of assets and houses isn’t really scalable
- Peak shaving not very visible



## Assumptions:
- All assets have more or less random power characteristics
- Assets can’t fail
- No complex EV charging profiles supported
- No PV curtailing
- Not taking power factors into account
- Yaml configuration file is always correct
- Summer has more sun than winter
- All assets are directly connected to house

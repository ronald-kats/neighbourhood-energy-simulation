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
import { resolve } from 'node:path';
import { loadConfig } from './config/loader.js';
import { SimulationEngine } from './simulation/engine.js';
import { createHTTPServer } from './server.js';

// Parse command-line arguments
const args = process.argv.slice(2);
let configPath = resolve('config.yaml');
let port = 3000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && args[i + 1]) {
    configPath = resolve(args[++i]);
  } else if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[++i], 10);
  }
}

// Load config
console.log(`Loading config from: ${configPath}`);
const config = loadConfig(configPath);
console.log(`Seed: ${config.simulation.seed}`);
console.log(`Step size: ${config.simulation.stepSizeMinutes} min`);
console.log(`Speed: ${config.simulation.speedMultiplier}x`);
console.log(`Houses: ${config.houses.count}`);
console.log(`Public chargers: ${config.publicChargers.count}`);

// Create engine
const engine = new SimulationEngine(config, (state) => {
  // Optional: log to console at reduced rate
  if (Math.random() < 0.01) {
    process.stdout.write(`\r${state.displayTime}  Net: ${state.netPower_kW.toFixed(1)} kW   `);
  }
});

// Create and start server
const server = createHTTPServer(engine);
server.listen(port, () => {
  console.log(`\nServer running at http://localhost:${port}`);
  console.log('Open the above URL in a browser to view the simulation.\n');
  engine.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  engine.pause();
  server.close();
  process.exit(0);
});
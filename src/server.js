import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create an HTTP server that serves the UI and SSE endpoint.
 * @param {import('../simulation/engine.js').SimulationEngine} engine
 * @returns {import('node:http').Server}
 */
export function createHTTPServer(engine) {
  const sseClients = new Set();

  // Serve the HTML file
  const htmlPath = join(__dirname, 'ui', 'index.html');
  const htmlContent = readFileSync(htmlPath, 'utf8');

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // SSE endpoint
    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial state immediately
      const state = engine._buildState();
      res.write(`data: ${JSON.stringify({ ...state, event: 'state' })}\n\n`);

      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // Control endpoint
    if (url.pathname === '/control' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { action, value } = JSON.parse(body);
          switch (action) {
            case 'play':
              engine.resume();
              break;
            case 'pause':
              engine.pause();
              break;
            case 'setSpeed':
              engine.setSpeed(Number(value));
              break;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Bad request' }));
        }
      });
      return;
    }

    // State endpoint (for initial load)
    if (url.pathname === '/state') {
      const state = engine._buildState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    // Serve index.html
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlContent);
  });

  // Hook engine to broadcast to SSE clients
  const originalOnTick = engine.onTick;
  engine.onTick = (state) => {
    // Broadcast to all SSE clients
    const data = `data: ${JSON.stringify({ ...state, event: 'state' })}\n\n`;
    for (const client of sseClients) {
      client.write(data);
    }
    // Also call original callback if set
    if (originalOnTick) {
      originalOnTick(state);
    }
  };

  return server;
}
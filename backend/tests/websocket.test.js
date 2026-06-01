import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { WebSocket } from 'ws';
import {
  initWebSocket,
  closeWebSocket,
  broadcast,
} from '../src/services/websocketService.js';

describe('WebSocket server', () => {
  let server;
  let port;

  beforeAll(async () => {
    server = createServer();
    initWebSocket(server);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    closeWebSocket();
    await new Promise((resolve) => server.close(resolve));
  });

  it('conecta y recibe eventos broadcast', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages = [];

    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    broadcast('sync:complete', { matchesCount: 72, teamsCount: 48 });

    const event = await new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        const match = messages.find((m) => m.type === 'sync:complete');
        if (match) return resolve(match);
        if (Date.now() - started > 3000) return reject(new Error('broadcast timeout'));
        setTimeout(check, 10);
      };
      check();
    });

    expect(messages.some((m) => m.type === 'connected')).toBe(true);
    expect(event.matchesCount).toBe(72);
    expect(event.teamsCount).toBe(48);
    ws.close();
  }, 10000);
});

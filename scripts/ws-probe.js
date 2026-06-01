#!/usr/bin/env node
import { WebSocket } from 'ws';

const ws = new WebSocket('ws://127.0.0.1:5000/ws');
const events = [];

ws.on('open', () => console.log('WS open'));
ws.on('message', (data) => {
  const payload = JSON.parse(data.toString());
  events.push(payload);
  console.log('WS event:', payload.type, payload.matchesCount ?? '', payload.teamsCount ?? '');

  if (payload.type === 'connected') {
    fetch('http://127.0.0.1:5000/api/health')
      .then((r) => r.json())
      .then((health) => {
        console.log('Health:', JSON.stringify(health));
        ws.close();
      });
  }
});

ws.on('close', () => {
  const ok = events.some((e) => e.type === 'connected');
  console.log(ok ? 'WebSocket OK' : 'WebSocket FAILED');
  process.exit(ok ? 0 : 1);
});

setTimeout(() => {
  console.error('WebSocket probe timeout');
  process.exit(1);
}, 8000);

import { WebSocketServer } from 'ws';

let wss = null;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));
  });

  console.log('WebSocket server ready at /ws');
}

export function closeWebSocket() {
  if (!wss) return;
  for (const client of wss.clients) {
    client.close();
  }
  wss.close();
  wss = null;
}

export function broadcast(type, payload = {}) {
  if (!wss) return;

  const message = JSON.stringify({ type, ...payload, at: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

export function notifyMatchesUpdated(meta = {}) {
  broadcast('matches:updated', meta);
}

export function notifyLeaderboardUpdated(meta = {}) {
  broadcast('leaderboard:updated', meta);
}

export function notifySyncComplete(meta = {}) {
  broadcast('sync:complete', meta);
}

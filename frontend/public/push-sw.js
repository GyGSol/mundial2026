self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: 'Mundial 2026', body: event.data?.text() || 'Novedad en vivo' };
  }

  const title = payload.title || 'Mundial 2026';
  const kind = payload.notificationKind || 'live';
  const goalKey = payload.goalKey ? `-${payload.goalKey}` : '';
  const tag = payload.matchId
    ? `match-${kind}-${payload.matchId}${goalKey}`
    : 'mundial2026';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    renotify: kind === 'goal',
    data: {
      url: payload.url || '/predictions',
      notificationKind: kind,
      matchId: payload.matchId ?? null,
      scorer: payload.scorer ?? null,
      country: payload.country ?? null,
      tournamentGoalNumber: payload.tournamentGoalNumber ?? null,
      score: payload.score ?? null,
      pointsEarned: payload.pointsEarned ?? null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/predictions';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

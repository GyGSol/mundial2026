# Ranking dashboard — rendimiento con partidos en vivo

Documentación de optimizaciones para la página **Ranking** (`/leaderboard`) cuando hay uno o más partidos en vivo. Tickets Jira relacionados: **FBL-17**, **FBL-18**, **FBL-19**.

| Ticket | Tema | Deploy prod |
|--------|------|-------------|
| FBL-17 | Acordeón en barra en vivo, proyección Mongo liviana, `detailMatchId` | v613 |
| FBL-18 | Gol duplicado en cronología (merge por jugador + minuto base) | v614 |
| FBL-19 | Caché en capas + acordeón vía `live-snapshot` (latencia 10–21 s → segundos) | v615 |

---

## Problema original

Con **2+ partidos en vivo**, el dashboard (`GET /api/leaderboard/dashboard?detailMatchId=…`) podía tardar **10–21 s** porque:

1. Cada cambio de acordeón y cada poll (~5 s) reconstruía payload completo.
2. La caché del dashboard incluía `detailMatchId` en la clave → miss al expandir otro partido.
3. TTL en vivo **2,5 s** vs poll frontend **~5 s** → misses frecuentes.
4. Enriquecimiento FIFA/lineups se repetía por partido sin caché granular.

Heroku **R14** (~603 MB) en dyno Standard-1X es un tema aparte (memoria de proceso); estas optimizaciones reducen **latencia y CPU por request**, no garantizan eliminar R14.

---

## Arquitectura actual (post FBL-19)

```
GET /api/leaderboard/dashboard?groupId=&detailMatchId=
        │
        ▼
 rankingDashboardCache.js          (TTL: 10 s en vivo, 15 s idle)
        │
        ▼
 getRankingDashboard()
        │
        ├─ fetchRankingDashboardMatchInputs()   ← proyección liviana (FBL-17)
        │
        ├─ featuredBarInputsSignature()       ← invalidación por marcador/cronología
        │
        └── Promise.all([
              getCachedFeaturedBarPayload(),   ← barra en vivo + recientes
              getCachedRankingDashboardShell() ← leaderboard, prize pool, próximos
            ])
```

### Capas de caché (in-memory, por dyno)

| Módulo | Clave | TTL (vivo) | Contenido |
|--------|-------|------------|-----------|
| `rankingDashboardShellCache.js` | `groupId + userId + inputsSignature` | 10 s | Leaderboard, indicadores PA/GL, prize pool, próximos partidos |
| `liveFeaturedBarCache.js` | `userId + inputsSignature + detailMatchId` | 10 s | `liveMatches`, `recentFinishedMatches` enriquecidos |
| `liveFeaturedBarService.js` | `_id + userId + tier + revision` | 10 s | Enriquecimiento **por partido** (`full` vs `summary`) |
| `rankingDashboardCache.js` | `groupId + userId + detailMatchId` | 10 s | Respuesta compuesta final |

**`inputsSignature`** (`matchEnrichmentRevision.js`): hash corto por partido con `homeScore`, `awayScore`, `time_elapsed`, longitud de cronología FIFA y flag `finished`. Si cambia el marcador o entra un evento, invalida shell y barra sin esperar TTL.

**Invalidación global:** `invalidateRankingDashboardCache()` (p. ej. tras sync o fin de partido) limpia dashboard, shell y featured bar vía `matchRelatedCaches.js`.

---

## Frontend — acordeón sin re-fetch completo

Archivo: `frontend/src/pages/LeaderboardPage.jsx`

| Acción | Comportamiento |
|--------|----------------|
| Poll automático (`useLiveData`) | Solo depende de `effectiveGroupId`; usa `expandedLiveMatchIdRef` para `detailMatchId` sin re-suscribir |
| Usuario expande otro partido en vivo | `GET /api/matches/live-snapshot?detailMatchId=` + `mergeLiveSnapshot()` sobre estado local |
| WebSocket `live-snapshot` | Mismo merge vía `patchLiveSnapshot` |

El dashboard completo **no** se vuelve a pedir solo por cambiar el acordeón.

---

## API relacionadas

| Ruta | Uso |
|------|-----|
| `GET /api/leaderboard/dashboard` | Carga inicial + poll periódico |
| `GET /api/matches/live-snapshot` | Patch liviano al cambiar acordeón o evento WS |
| `GET /api/leaderboard/finished-archive` | Archivo de finalizados (caché aparte) |

Query `detailMatchId`: ObjectId del partido expandido en la barra en vivo. Si se omite, el backend elige el partido destacado por defecto.

---

## FBL-18 — cronología sin goles duplicados

Archivo: `backend/src/services/matchLiveData.js`

Cuando FIFA y goleadores difieren en **descuento** (`extraMinute`), el mismo gol podía aparecer dos veces. Fix:

- `timelineIncludesGoal`: match por jugador + minuto base aunque difiera descuento.
- `deduplicateTimelineGoals`: merge en mismo minuto con distinto descuento.

Tests: `backend/tests/matchLiveData.test.js`.

---

## Tests de regresión

```bash
cd backend
unset MONGODB_URI
npx vitest run \
  tests/rankingDashboardCache.test.js \
  tests/rankingDashboardShellCache.test.js \
  tests/liveFeaturedBarService.test.js \
  tests/matchEnrichmentRevision.test.js \
  tests/matchLiveData.test.js
```

---

## QA manual sugerido

1. Con **2+ en vivo**, abrir Ranking y alternar acordeón entre partidos → respuesta en **segundos** (no 10–21 s).
2. Verificar cronología, goleadores y lineups del partido expandido.
3. Dejar poll ~30 s: UI fluida, datos actualizados.
4. Tras gol: marcador y cronología se refrescan en ≤10 s (TTL) o antes si invalidación por sync.

---

## Operaciones / gotchas

- **H15 en `/ws` (~55 s):** idle timeout normal en Heroku; el cliente reconecta.
- **Caché por dyno:** tras restart o múltiples dynos, primera request puede ser más lenta (cold).
- **R14 memoria:** considerar upgrade dyno o perfilado aparte si persiste con pocos usuarios concurrentes.

---

## Referencias en código

| Archivo | Rol |
|---------|-----|
| `backend/src/services/rankingDashboardService.js` | Orquestación shell + featured bar |
| `backend/src/services/rankingDashboardShellCache.js` | Caché shell |
| `backend/src/services/liveFeaturedBarCache.js` | Caché barra |
| `backend/src/services/liveFeaturedBarService.js` | Enriquecimiento + caché por partido |
| `backend/src/services/matchEnrichmentRevision.js` | Firma de invalidación |
| `backend/src/services/liveBarMatchProjection.js` | Proyección Mongo liviana |
| `frontend/src/lib/patchLiveMatchSnapshot.js` | Merge snapshot en cliente |
| `frontend/src/pages/LeaderboardPage.jsx` | Acordeón + poll |

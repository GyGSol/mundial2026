# Copa Fubols — playoff por grupo (FBL-25)

Playoff de los **8 mejores humanos** de cada grupo de predicciones, cruzado con partidos reales del Mundial (dieciseisavos en adelante). Ticket Jira: **FBL-25**.

- **UI:** Mundial → pestaña **Copa Fubols** (`/mundial?tab=fubols-cup`) · Ranking → selector **Torneo → Copa Fubols**
- **Backend:** `backend/src/services/fubolsCupService.js`
- **Caché dashboard:** `backend/src/services/fubolsCupDashboardCache.js`
- **Scoring / desempate:** `shared/fubolsCupScoring.js`
- **Config del cuadro:** `shared/fubolsCupBracket.js`
- **Frontend bracket:** `frontend/src/components/worldcup/FubolsCupBracket.jsx`
- **Tiles de partido:** `frontend/src/components/worldcup/FubolsCupMatchTile.jsx`

## Estructura del cuadro

| Ronda | `roundKey` | Partidos WC | Cruces |
|-------|------------|-------------|--------|
| Cuartos | `quarter_final` | 89–96 | Seeds 1v8, 2v7, 3v6, 4v5 |
| Semifinales (ganadores) | `semi_final` | 97–100 | W(QF0) vs W(QF3), W(QF1) vs W(QF2) |
| Semifinal de perdedores | `losers_semifinal` | **mismos 97–100** por cruce | L(QF0) vs L(QF3), L(QF1) vs L(QF2) |
| Partido por el tercer puesto | `losers_final` | **103** (dos cruces) | **Cruce 1:** W(LSF0) vs W(LSF1) · **Cruce 2:** L(SF0) vs L(SF1) |
| Final | `final` | 101+102+104 | W(SF0) vs W(SF1) |

Los perdedores de semifinal del cuadro ganador juegan el cruce 2 del partido 103. Los ganadores de la semifinal de perdedores de cuartos juegan el cruce 1 del mismo partido FIFA. La final de campeón es independiente.

### Migración de esquema (`third_place` → cuadro perdedores)

Torneos `running` creados antes de jul-2026 guardaban 4 rondas (`quarter_final`, `semi_final`, `third_place`, `final`). El esquema actual tiene 5 rondas (`losers_semifinal`, `losers_final` con 2 duelos en 103).

| Función | Rol |
|---------|-----|
| `migrateFubolsCupBracketSchema` | [`shared/fubolsCupBracket.js`](../../shared/fubolsCupBracket.js) no — está en [`fubolsCupService.js`](../../backend/src/services/fubolsCupService.js): inserta `losers_semifinal`, convierte `third_place` → `losers_final` (duel 1 = perdedores SF ganadoras; duel 0 = ganadores LSF) |
| `maybeMigrateBracketSchema` | Aplica migración + `assignBracketFromWinners` + `reconcileWorldCupMatchAssignments` + `save` + invalida caché dashboard |
| `processFubolsCupForGroup` | Llama `maybeMigrateBracketSchema` al procesar partidos |
| `loadTournamentForDashboard` | **También** llama `maybeMigrateBracketSchema` al abrir la Copa (fix v699) |

**Gotcha (prod jul-2026):** el deploy del frontend/backend nuevo no alcanza si Mongo sigue con `third_place`; la UI no muestra `losers_semifinal` hasta migrar el documento. Tras deploy de estructura nueva, verificar en Atlas/Heroku que `rounds[].roundKey` incluya `losers_semifinal` y `losers_final`, o ejecutar `processFubolsCupForGroup` para cada grupo `running`.

Sincronización WC en `reconcileWorldCupMatchAssignments`: `losers_semifinal.duels[i]` copia los mismos `worldCupExternalIds` que `semi_final.duels[i]`; cada duelo de `losers_final` recibe `['103']`.

## Puntos mostrados en el cruce

En cada enfrentamiento hay **dos conceptos distintos** — no mezclarlos en la columna PTS:

| Columna | Qué muestra | Fuente |
|---------|-------------|--------|
| **Gdif** | Promedio de diferencia de goles del **torneo de predicciones** del grupo | `player.difGl`, `difGv`, `pj` (leaderboard) |
| **Pts tot.** / **Pts tot. parcial** | Puntos acumulados del **enfrentamiento** (suma de los partidos WC del cruce) | `player.matchPoints` |

En **móvil** (`< sm`): la columna PTS muestra solo **Pts** (tooltip con el significado completo). Desde `sm` en adelante: **Pts tot. parcial** / **Pts tot.** — ver sección [Vista mobile](#vista-mobile).

### Reglas de `matchPoints` (header del duelo)

Función central: `pickLiveDuelHeaderPoints(worldCupMatches)` en `fubolsCupService.js`.

1. **Antes de que arranque cualquier partido del cruce** → `0` / `0`, etiqueta **Pts tot. parcial**.
2. **Con al menos un partido con score** (live o finished) → **suma** de `duelSlice.pointsA/B` de todos los partidos que ya tienen puntos.
3. **Mientras quede algún partido `live` o `upcoming`** → sigue siendo parcial (`partialHeaderPoints: true`).
4. **Cruce resuelto** (`resolvedAt` + `winnerId`) → suma de `matchResults` persistidos; etiqueta **Pts tot.** (no parcial).

Enriquecimiento en dashboard: `enrichDuelsWithLiveSlices()` asigna `matchPoints` a **todos** los cruces con ambos jugadores, no solo los `isLiveDuel`.

Cada **tile** de partido sigue mostrando los puntos **de ese partido** (`duelSlice`), no el acumulado del cruce.

### Cruce en vivo (`isLiveDuel`)

Cuando hay partido `live` o todos los partidos del cruce terminaron con score:

- Borde verde en la card (`border-emerald-500/30`).
- Se calcula ganador provisional con `resolveDisplayDuelWinnerId` (victorias por partido; desempate si aplica).
- Layout sin columna `#` (solo nombre, Gdif, Pts).

### Desempate

Si empatan en puntos del cruce tras todos los partidos:

- **Menor Gdif del torneo** gana (`pickByGoalDiffTiebreak` en `shared/fubolsCupScoring.js`).
- Mensaje en UI vía `duel.tiebreak.summary` (castellano).

## Sección Prueba (demo)

`buildLiveDemoDuel()` expone un cruce **Futbot vs usuario logueado** al final del bracket:

- Partidos demo: ESP–AUT (obligatorio) + POR–CRO si existen en DB.
- Misma lógica de `matchPoints` acumulados y tiles con puntos por partido.
- `hideViewerPrediction` en tiles demo / live (no mostrar pronóstico del rival en vivo).

## Vista mobile

Componentes: `FubolsCupBracket.jsx` (cruces) y `FubolsCupMatchTile.jsx` (partidos del cruce).

### Cruces (`DuelCard`)

| Aspecto | Móvil | Desktop (`sm+`) |
|---------|-------|-----------------|
| Encabezado PTS | **Pts** + `title` tooltip | **Pts tot. parcial** / **Pts tot.** |
| Grilla jugadores | `# · jugador · Gdif · Pts` con columnas `1.5rem / 1fr / 2.75rem / 2.25rem` | Columnas más anchas (`2.5rem / … / 3.5rem`) |
| Padding card | `p-2.5`, `overflow-hidden`, `min-w-0` | `p-5` |

Helper: `PtsColumnHeader` — evita que **"Pts tot. parcial"** se parta en dos líneas en pantallas estrechas.

### Tiles de partido

| Aspecto | Comportamiento mobile |
|---------|----------------------|
| Encabezado | Línea 1: partido + fase (+ badge En vivo). Línea 2: fecha/hora (ART). Línea 3: estadio (truncate) |
| Equipos | Grilla `local \| marcador \| visitante` (`grid-cols-[1fr_auto_1fr]`); visitante alineado a la derecha |
| Texto | `text-[11px]` en metadata; `sm:text-xs` en desktop |

Contenedor bracket: `overflow-x-hidden` en el wrapper principal para evitar scroll horizontal.

## API

`GET /api/competition-groups/:groupId/fubols-cup` (auth) devuelve `rounds[].duels[]` con:

- `playerA` / `playerB`: `id`, `name`, `seed`, `avatarUrl`, `matchPoints`, `totalPoints` (interno; **no** usar en PTS del bracket), stats Gdif.
- `partialHeaderPoints`, `isLiveDuel`, `worldCupMatches`, `tiebreak`, `demoDuel` (raíz del payload).

Ruta consumida por `LeaderboardPage` (`competitionGroupsApi.fubolsCup.get`) y `FubolsCupSection` en Mundial.

## Rendimiento y caché (H12 en prod, jul-2026)

### Problema

En prod, al elegir **Torneo → Copa Fubols** en el ranking, el panel mostraba *"El servidor no está disponible temporalmente"* (HTTP **503**). Logs Heroku: **H12 Request timeout** a los 30 s en `GET .../fubols-cup`. El ranking general cargaba; solo fallaba el cuadro de la Copa.

Causa: `getFubolsCupDashboard` llamaba **`processFubolsCupForGroup` en cada GET** (resolver duelos, rescoring, pagos Fubols, saves) más **N+1** (`Match.findOne` + `Prediction.find` por partido en `enrichDuelsWithLiveSlices`). Sin caché in-memory (a diferencia del ranking en vivo, FBL-19).

### Arquitectura actual

```
GET /api/competition-groups/:groupId/fubols-cup
        │
        ▼
 fubolsCupDashboardCache.js     (TTL: 10 s con WC live, 15 s running, 30 s preview, 60 s completed)
        │
        ▼
 getFubolsCupDashboard()
        │
        ├─ loadTournamentForDashboard()     ← solo lectura (sin process)
        ├─ loadEnrichedMatchesByExternalId()
        ├─ enrichDuelsWithLiveSlices()      ← batch Match + Prediction (2 queries)
        └─ buildLiveDemoDuel()
```

**Escritura / avance del torneo** (seeds, resolver cruces, pagos): solo vía `processFubolsCupForGroup`, invocado desde:

- `processFubolsCupAfterMatchFinished` (hook al finalizar partido WC relevante)
- no en cada vista del dashboard

Tras `processFubolsCupForGroup` se invalida `invalidateFubolsCupDashboardCache(groupId)`. También se invalida desde `invalidateMatchRelatedCaches` / `invalidateFinishedMatchArchiveCaches` cuando cambian partidos o puntuación.

### Objetivo de latencia

Respuesta **&lt; 3 s** p95 en Heroku Basic (límite duro 30 s). Smoke post-deploy: Ranking → Copa Fubols sin error; logs sin H12 en `fubols-cup`.

## Tests

`backend/tests/fubolsCupService.test.js`:

- `cruce pendiente muestra 0 pts del enfrentamiento, no totales del torneo`
- `demoDuel suma puntos parciales de todos los partidos con score`
- `cruce en vivo expone isLiveDuel con puntos del partido en dashboard`
- Desempate Gdif en empate de puntos del partido/cruce
- `getFubolsCupDashboard no ejecuta processFubolsCupForGroup (solo lectura)`
- `getFubolsCupDashboard migra esquema viejo al cargar`
- `migra torneo con third_place al esquema de cuadro perdedores`

`backend/tests/fubolsCupDashboardCache.test.js`: deduplicación, invalidación por grupo, TTL con partidos live.

`backend/tests/fubolsCupBracket.test.js`: shuffle, sync 97–100, dos cruces en 103.

Ejecutar con DB local de test (nunca Atlas prod):

```bash
unset MONGODB_URI
cd backend && MONGODB_URI=mongodb://127.0.0.1:27017/mundial2026_test npx vitest run tests/fubolsCupService.test.js tests/fubolsCupDashboardCache.test.js
```

## Deploys relevantes (FBL-25)

| Release | Commit | Cambio |
|---------|--------|--------|
| v681 | `5b6f8be` | Desempate por Gdif (no puntos totales del torneo) |
| v682 | `12778cb` | Demo con 2 partidos (ESP + POR) |
| v683 | `f7c232d` | Puntos parciales en header (último terminado / live) |
| v686 | `82a1d2e` | Suma parcial de todos los partidos con score |
| v692 | `1c8aa02` | PTS del enfrentamiento (0 antes del partido), no `totalPoints` |
| v693 | `48f685d` | Vista mobile: PTS abreviado, tiles con fecha y grilla de equipos |
| v697 | `28d5b12` | Fix H12: lectura sin `processFubolsCupForGroup` en GET, caché dashboard, batch queries live |
| v698 | `bb44659` | Cuadro perdedores: `losers_semifinal` (97–100) + dos cruces en 103 + final |
| v699 | `ced05be` | Migración de esquema al cargar dashboard (`loadTournamentForDashboard`) |

App: `mundial2026-pred` · [DEPLOYMENT.md](./DEPLOYMENT.md)

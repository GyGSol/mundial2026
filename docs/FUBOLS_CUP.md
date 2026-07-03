# Copa Fubols — playoff por grupo (FBL-25)

Playoff de los **8 mejores humanos** de cada grupo de predicciones, cruzado con partidos reales del Mundial (dieciseisavos en adelante). Ticket Jira: **FBL-25**.

- **UI:** Mundial → pestaña **Copa Fubols** (`/mundial?tab=fubols-cup`)
- **Backend:** `backend/src/services/fubolsCupService.js`
- **Scoring / desempate:** `shared/fubolsCupScoring.js`
- **Frontend bracket:** `frontend/src/components/worldcup/FubolsCupBracket.jsx`
- **Tiles de partido:** `frontend/src/components/worldcup/FubolsCupMatchTile.jsx`

## Puntos mostrados en el cruce

En cada enfrentamiento hay **dos conceptos distintos** — no mezclarlos en la columna PTS:

| Columna | Qué muestra | Fuente |
|---------|-------------|--------|
| **Gdif** | Promedio de diferencia de goles del **torneo de predicciones** del grupo | `player.difGl`, `difGv`, `pj` (leaderboard) |
| **Pts tot.** / **Pts tot. parcial** | Puntos acumulados del **enfrentamiento** (suma de los partidos WC del cruce) | `player.matchPoints` |

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

## API

`GET /api/groups/:groupId/fubols-cup` (vía dashboard) devuelve `rounds[].duels[]` con:

- `playerA` / `playerB`: `id`, `name`, `seed`, `avatarUrl`, `matchPoints`, `totalPoints` (interno; **no** usar en PTS del bracket), stats Gdif.
- `partialHeaderPoints`, `isLiveDuel`, `worldCupMatches`, `tiebreak`, `demoDuel` (raíz del payload).

## Tests

`backend/tests/fubolsCupService.test.js`:

- `cruce pendiente muestra 0 pts del enfrentamiento, no totales del torneo`
- `demoDuel suma puntos parciales de todos los partidos con score`
- `cruce en vivo expone isLiveDuel con puntos del partido en dashboard`
- Desempate Gdif en empate de puntos del partido/cruce

Ejecutar con DB local de test (nunca Atlas prod):

```bash
unset MONGODB_URI
cd backend && MONGODB_URI=mongodb://127.0.0.1:27017/mundial2026_test npx vitest run tests/fubolsCupService.test.js
```

## Deploys relevantes (FBL-25)

| Release | Commit | Cambio |
|---------|--------|--------|
| v681 | `5b6f8be` | Desempate por Gdif (no puntos totales del torneo) |
| v682 | `12778cb` | Demo con 2 partidos (ESP + POR) |
| v683 | `f7c232d` | Puntos parciales en header (último terminado / live) |
| v686 | `82a1d2e` | Suma parcial de todos los partidos con score |
| v692 | `1c8aa02` | PTS del enfrentamiento (0 antes del partido), no `totalPoints` |

App: `mundial2026-pred` · [DEPLOYMENT.md](./DEPLOYMENT.md)

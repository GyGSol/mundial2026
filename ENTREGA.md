# Paquete de entrega — Mundial 2026 Predicciones

Documento para el desarrollador que recibe el `.zip`. Contiene todo lo necesario para levantar el proyecto, poblar la base y desplegarlo en la empresa.

## Contenido del proyecto

Monorepo npm workspaces:

| Carpeta | Rol |
|---------|-----|
| `backend/` | API Express + MongoDB + WebSocket + sync con worldcup26.ir |
| `frontend/` | React + Vite + Tailwind + shadcn/ui |
| `scripts/` | Utilidades (`copy-frontend.js`, `prepare-package.js`, `ws-probe.js`) |
| `.agents/skills/` | Skills de Cursor (shadcn, TDD, etc.) — opcional |

## Requisitos

- **Node.js** 20+ (recomendado 24.x, ver `engines` en `package.json`)
- **MongoDB** local (`mongodb://127.0.0.1:27017/mundial2026`) o **MongoDB Atlas**
- Cuenta en [worldcup26.ir](https://worldcup26.ir) (recomendado para los 104 partidos y 48 equipos reales)

## Primer arranque (desde cero)

```bash
# 1. Descomprimir y entrar al proyecto
cd Mundial2026

# 2. Instalar dependencias (el zip NO incluye node_modules)
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env: MONGODB_URI, JWT_SECRET, WORLD_CUP_SYNC_EMAIL/PASSWORD

# 4. Arrancar en desarrollo (MongoDB debe estar corriendo)
npm run dev
```

- Frontend: http://localhost:5173  
- Backend: http://localhost:5000  
- WebSocket: ws://localhost:5000/ws  

## Poblar la base de datos

```bash
npm run sync
```

Descarga desde **worldcup26.ir**:

- 48 equipos → `teams`
- 12 grupos FIFA → `groups`
- 16 estadios (con zona horaria IANA) → `stadiums`
- 104 partidos → `matches` (fase de grupos + placeholders de eliminatorias)

Sin credenciales de sync, la app arranca con **datos demo** mínimos.

### Corregir horarios de partidos (si ya había datos viejos)

Si `kickoffAt` quedó mal guardado antes de la corrección de zonas horarias:

```bash
npm run sync
npm run fix-kickoffs -w backend
```

### Reset completo de tablas

```bash
npm run reset-db
npm run sync
```

Borra usuarios, predicciones, partidos, equipos, grupos de amigos, membresías, estadios y metadatos de sync.

## Variables de entorno (`.env`)

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del backend (default 5000) |
| `MONGODB_URI` | URI de MongoDB |
| `JWT_SECRET` | Secreto para tokens de auth |
| `CLIENT_ORIGIN` | Origen CORS del frontend (`http://localhost:5173` o URL de producción) |
| `WORLD_CUP_API_URL` | https://worldcup26.ir |
| `WORLD_CUP_SYNC_EMAIL` | Email registrado en worldcup26.ir |
| `WORLD_CUP_SYNC_PASSWORD` | Password de sync |
| `SYNC_INTERVAL_MS` | Intervalo del job automático (default 60000) |
| `SIMULATION_ENABLED` | `false` deshabilita rutas `/api/simulation` |

**No incluir `.env` real en el zip.** Solo `.env.example`.

## Colecciones MongoDB

| Colección | Modelo | Contenido |
|-----------|--------|-----------|
| `users` | User | Usuarios (registro sin grupo obligatorio) |
| `usergroupmemberships` | UserGroupMembership | Usuario ↔ grupos de competencia (varios grupos) |
| `competitiongroups` | CompetitionGroup | Ligas/grupos de amigos (premios, admin) |
| `predictions` | Prediction | Predicciones por partido/usuario |
| `matches` | Match | Partidos oficiales y simulación (`sim-*`) |
| `teams` | Team | 48 selecciones |
| `groups` | Group | Grupos A–L del mundial |
| `stadiums` | Stadium | Sedes + `timezone` IANA |
| `simulationstates` | SimulationState | Simulación activa |
| `syncmetas` | SyncMeta | Última sync con la API |

## Rutas API principales

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/auth/register`, `/login` | Registro e inicio (sin grupo obligatorio) |
| GET | `/api/auth/me` | Perfil + grupo activo |
| GET | `/api/matches` | Partidos (`kickoffAt`, `lockAt`, estado de predicción) |
| PUT | `/api/predictions/:matchId` | Guardar predicción |
| GET | `/api/leaderboard` | Ranking (`groupId`: id, `__all__`, `__nogroup`) |
| GET/POST/PUT/DELETE | `/api/competition-groups/*` | Crear, unirse, activar, editar, borrar grupos |
| GET | `/api/world-cup` | Mundial: grupos, fase final, estadísticas |
| GET/POST/DELETE | `/api/simulation/*` | Simulación de torneo |
| GET | `/api/health` | Health check |

## Páginas del frontend

| Ruta | Descripción |
|------|-------------|
| `/` | Ranking (global, por grupo, o sin grupo) |
| `/predictions` | Cargar predicciones (cierre 1 h antes del kickoff) |
| `/mundial` | Grupos FIFA, fase final, estadísticas, estadios |
| `/groups` | Grupos de competencia: crear, unirse, premios, admin |
| `/groups/new` | Atajo para crear grupo |
| `/simulation` | Simular torneo (quick / full) |
| `/rules` | Reglas de puntuación y desempates |
| `/login`, `/register` | Auth |

## Reglas de juego importantes

### Cierre de predicciones

- **1 hora antes** del kickoff oficial (`predictionLockService.js`).
- Si no hay predicción al cerrar → se guarda **0-0** automáticamente.
- El kickoff se guarda en **UTC** calculado desde `local_date` de la API + zona horaria del **estadio** (`kickoffTimeService.js`, `stadiumTimezones.js`).
- En la UI, las fechas se muestran en la **zona horaria del navegador** del jugador.

### Puntuación por partido

| Regla | Puntos |
|-------|--------|
| Resultado correcto (incl. empate) | +3 |
| Goles local exactos | +1 |
| Goles visitante exactos | +1 |
| Total de goles exacto | +1 |

### Punto consuelo (PB)

+1 si el jugador suma 0 puntos en **3 partidos consecutivos** (`consolationBonusService.js`). En el ranking, **menor PB** gana en desempate.

**Desempate general:** puntos → PA → (GL+GV) → GT → PB.

## Grupos de competencia (entre amigos)

- Un usuario puede estar en **varios grupos** y elegir uno **activo** para filtrar ranking.
- Ranking **global** (`__all__`), por grupo, o **Sin grupo** (`__nogroup`).
- Admin del grupo: editar nombre, cantidad de ganadores, premios; borrar grupo.
- Grupos legacy sin `createdBy`: el primer miembro que edita puede reclamar admin.

## Simulación de torneo

- **Modo quick:** subset de partidos y jugadores ficticios.
- **Modo full:** 48 equipos, 72 grupos + 32 eliminatorias (`sim-{runId}-N`).
- En `/mundial` → Fase Final: si hay partidos `sim-*`, se priorizan; se ocultan placeholders oficiales sin equipos (`homeTeamId/awayTeamId = '0'`).

## Sync y scripts npm

| Comando | Descripción |
|---------|-------------|
| `npm run sync` | Sync manual con worldcup26.ir |
| `npm run fix-kickoffs -w backend` | Recalcula `kickoffAt` desde estadio + `local_date` |
| `npm run reset-db` | Vacía la base |
| `npm run simulate` | CLI de simulación |
| `npm test` | Tests backend (Vitest) |

Job periódico: `backend/src/jobs/syncMatches.job.js`.

## Tests

```bash
npm test
```

47+ tests: scoring, leaderboard, PB, grupos de competencia, kickoff/zonas horarias, simulación, worldCup stats, websocket, API client.

## Build y deploy en la empresa

```bash
npm run build    # frontend → backend/public
npm start        # sirve API + SPA en un solo proceso
```

### Heroku (referencia)

Ver **`HEROKU.md`**: app de ejemplo `mundial2026-pred`, variables Atlas, `git push heroku main`, `heroku run npm run sync`.

Patrón típico en empresa (Docker/K8s/VM):

1. MongoDB Atlas o cluster interno → `MONGODB_URI`
2. `npm ci` + `npm run build`
3. `NODE_ENV=production npm start` (o imagen con Node 24)
4. `CLIENT_ORIGIN` = URL pública del frontend
5. Tras el primer deploy: `npm run sync` (una vez o en job de init)

## Generar el zip de entrega

Desde la raíz del repo (quien empaqueta):

```bash
npm run package-zip
```

Crea `mundial2026-entrega.zip` excluyendo `node_modules`, `.env`, builds y el propio zip.

## Qué incluir / excluir al comprimir

**Incluir:** código fuente, tests, `package.json`, `Procfile`, `.env.example`, `README.md`, `ENTREGA.md`, `HEROKU.md`.

**Excluir:**

- `node_modules/`
- `.env`
- `frontend/dist/`, `backend/public/`
- `*.log`, `.DS_Store`, `*.zip`
- `.git/` (opcional; el zip de `package-zip` lo excluye)

## Mapa de archivos importantes

```
backend/src/
  config/env.js, db.js
  models/          # User, Match, Stadium, CompetitionGroup, UserGroupMembership...
  routes/          # auth, matches, predictions, leaderboard, competition-groups, world-cup
  services/
    scoringService.js
    leaderboardService.js
    competitionGroupService.js
    consolationBonusService.js
    predictionLockService.js
    kickoffTimeService.js
    stadiumTimezones.js
    syncService.js
    worldCupStatsService.js
    simulationService.js
    worldCupApiClient.js
  scripts/runSync.js, runSimulation.js, resetDatabase.js, fixKickoffTimes.js
frontend/src/
  pages/           # GroupsPage, WorldCupPage, LeaderboardPage...
  components/worldcup/WorldCupSections.jsx
  lib/dateFormat.js
```

## Flujo típico del otro desarrollador

1. Descomprimir → `npm install` → `cp .env.example .env`
2. Configurar MongoDB y credenciales worldcup26.ir
3. `npm run sync` → verificar `/mundial` y `/predictions`
4. Registrar usuario → crear o unirse a un grupo en `/groups`
5. Probar predicciones (ver hora de cierre en la tarjeta del partido)
6. `npm test` antes de cambios
7. `npm run build` + deploy según infra de la empresa (ver `HEROKU.md` como referencia)

## Contacto / contexto

Juego de predicciones Mundial FIFA 2026 (48 equipos, 104 partidos). API de datos: [worldcup26.ir](https://worldcup26.ir/api-docs/). Stack: Node + React + MongoDB + WebSockets.

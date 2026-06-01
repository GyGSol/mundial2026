# Paquete de entrega — Mundial 2026 Predicciones

Documento para el desarrollador que recibe el `.zip`. Contiene todo lo necesario para levantar el proyecto, poblar la base y continuar el desarrollo.

## Contenido del proyecto

Monorepo npm workspaces:

| Carpeta | Rol |
|---------|-----|
| `backend/` | API Express + MongoDB + WebSocket + sync con worldcup26.ir |
| `frontend/` | React + Vite + Tailwind + shadcn/ui |
| `scripts/` | Utilidades (`copy-frontend.js`, `ws-probe.js`) |
| `.agents/skills/` | Skills de Cursor (shadcn, TDD, etc.) |

## Requisitos

- **Node.js** 18+
- **MongoDB** local (`mongodb://127.0.0.1:27017/mundial2026`) o Atlas
- Cuenta en [worldcup26.ir](https://worldcup26.ir) (opcional pero recomendado para datos reales)

## Primer arranque (desde cero)

```bash
# 1. Descomprimir y entrar al proyecto
cd Mundial2026

# 2. Instalar dependencias (NO incluir node_modules en el zip)
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env: MONGODB_URI, JWT_SECRET, WORLD_CUP_SYNC_EMAIL/PASSWORD

# 4. Levantar MongoDB y arrancar en desarrollo
npm run dev
```

- Frontend: http://localhost:5173  
- Backend: http://localhost:5000  
- WebSocket: ws://localhost:5000/ws  

## Poblar la base de datos

Tras un reset o en instalación nueva:

```bash
npm run sync
```

Esto descarga desde **worldcup26.ir**:

- 48 equipos → colección `teams`
- 12 grupos → `groups`
- 104 partidos oficiales → `matches` (72 grupos + 32 eliminatorias placeholder)
- Estadios → `stadiums`

Sin credenciales de sync, la app arranca con **datos demo** mínimos.

### Reset completo de tablas

```bash
npm run reset-db
```

Elimina usuarios, predicciones, partidos (oficiales y simulación), equipos, grupos, estadios, metadatos de sync y estado de simulación. La base queda vacía; volver a ejecutar `npm run sync`.

## Variables de entorno (`.env`)

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del backend (default 5000) |
| `MONGODB_URI` | URI de MongoDB |
| `JWT_SECRET` | Secreto para tokens de auth |
| `CLIENT_ORIGIN` | Origen CORS del frontend (http://localhost:5173) |
| `WORLD_CUP_API_URL` | https://worldcup26.ir |
| `WORLD_CUP_SYNC_EMAIL` | Email registrado en worldcup26.ir |
| `WORLD_CUP_SYNC_PASSWORD` | Password de sync |
| `SYNC_INTERVAL_MS` | Intervalo del job automático (60000) |
| `SIMULATION_ENABLED` | `false` deshabilita rutas `/api/simulation` |

**No incluir `.env` real en el zip.** Solo `.env.example`.

## Colecciones MongoDB

| Colección | Modelo | Contenido |
|-----------|--------|-----------|
| `users` | User | Usuarios registrados (auth JWT) |
| `predictions` | Prediction | Predicciones por partido/usuario |
| `matches` | Match | Partidos oficiales (externalId numérico) y simulación (`sim-*`) |
| `teams` | Team | 48 selecciones |
| `groups` | Group | Grupos A–L |
| `stadiums` | Stadium | Sedes del mundial |
| `competitiongroups` | CompetitionGroup | Ligas/grupos de amigos entre usuarios |
| `simulationstates` | SimulationState | Estado de simulación activa |
| `syncmetas` | SyncMeta | Última sync con la API |

## Rutas API principales

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/auth/register`, `/login` | Registro e inicio de sesión |
| GET | `/api/matches` | Listado de partidos |
| PUT | `/api/predictions/:matchId` | Guardar predicción |
| GET | `/api/leaderboard` | Ranking global o por grupo |
| GET | `/api/world-cup` | Vista Mundial (grupos, fase final, stats) |
| GET/POST/DELETE | `/api/simulation/*` | Motor de simulación de torneo |
| GET | `/api/health` | Health check |

## Páginas del frontend

| Ruta | Descripción |
|------|-------------|
| `/` | Leaderboard |
| `/predictions` | Cargar predicciones |
| `/mundial` | Grupos, partidos, fase final, estadísticas |
| `/simulation` | Simular torneo completo (modo quick/full) |
| `/rules` | Reglas de puntuación y desempates |
| `/groups/new` | Crear grupo de competencia |
| `/login`, `/register` | Auth |

## Reglas de puntuación

Implementadas en `backend/src/services/scoringService.js`:

| Regla | Puntos |
|-------|--------|
| Resultado correcto (incl. empate) | +3 |
| Goles local exactos | +1 |
| Goles visitante exactos | +1 |
| Total de goles exacto | +1 |

**Punto consuelo (PB):** +1 si el jugador suma 0 puntos en 3 partidos consecutivos (`consolationBonusService.js`). En el ranking, PB es desempate final (menor PB = mejor posición).

Desempate general: puntos → PA → (GL+GV) → GT → PB.

## Simulación de torneo

- **Modo quick:** subset de partidos y jugadores ficticios.
- **Modo full:** 48 equipos (API), 72 partidos de grupos + 32 eliminatorias (`sim-{runId}-N`).
- La simulación **no** replaya resultados oficiales; genera marcadores aleatorios y predicciones de bots.
- En `/mundial` → Fase Final: si hay partidos `sim-*`, se muestran solo esos; se ocultan placeholders oficiales con `homeTeamId/awayTeamId = '0'`.

Archivos clave:

- `simulationService.js` — orquestación
- `simulationTournamentService.js` — bracket y cruces
- `worldCupStatsService.js` — agregación para UI Mundial

## Sync y jobs

- `npm run sync` → `backend/src/scripts/runSync.js`
- Job periódico en `backend/src/jobs/syncMatches.job.js` (rescoring + PB al actualizar resultados)

## Tests

```bash
npm test
```

38 tests en backend (Vitest): scoring, leaderboard, PB, simulación, worldCup stats, websocket, API client live.

## Build y deploy

```bash
npm run build    # compila frontend → backend/public
npm start        # sirve API + SPA
```

Heroku: ver `Procfile` y `heroku-postbuild` en `package.json`.

## Qué incluir / excluir al comprimir

**Incluir:**

- Todo el código fuente (`backend/src`, `frontend/src`, tests, scripts)
- `package.json`, workspaces, `Procfile`, `.env.example`
- `README.md`, `ENTREGA.md`, `.gitignore`
- `.agents/skills/` (opcional)

**Excluir (reduce mucho el tamaño):**

- `node_modules/` (raíz, backend y frontend)
- `.env` (secretos — el receptor crea el suyo)
- `frontend/dist/`
- `backend/public/` (se regenera con `npm run build`)
- `*.log`, `.DS_Store`

Ejemplo de zip desde la raíz del proyecto:

```bash
npm run reset-db
npm run prepare-package   # limpia artefactos de build
zip -r mundial2026-entrega.zip . \
  -x "node_modules/*" -x "**/node_modules/*" \
  -x ".env" -x "frontend/dist/*" -x "backend/public/*" \
  -x "*.log"
```

## Mapa de archivos importantes

```
backend/src/
  config/env.js, db.js
  models/          # Mongoose schemas
  routes/          # Express routers
  services/
    scoringService.js
    leaderboardService.js
    consolationBonusService.js
    matchPredictionRankingsService.js
    syncService.js
    worldCupStatsService.js      # Fase final, grupos, stats
    simulationService.js
    worldCupApiClient.js
  scripts/runSync.js, runSimulation.js, resetDatabase.js
frontend/src/
  pages/           # WorldCupPage, SimulationPage, RulesPage...
  components/worldcup/WorldCupSections.jsx
  hooks/useWebSocket.js, useLiveData.js
```

## Flujo típico del otro desarrollador

1. Descomprimir → `npm install` → `cp .env.example .env`
2. Configurar MongoDB y credenciales worldcup26.ir
3. `npm run sync` → verificar `/mundial` y `/predictions`
4. Registrar usuario → probar predicciones y leaderboard
5. Opcional: `/simulation` modo full → ver torneo simulado en `/mundial`
6. `npm test` antes de cambios

## Contacto / contexto

Proyecto: juego de predicciones Mundial FIFA 2026 (48 equipos, 104 partidos). API de datos: [worldcup26.ir](https://worldcup26.ir/api-docs/). Stack: Node + React + MongoDB + WebSockets en tiempo real.

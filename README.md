# Mundial 2026 — El Juego de Predicciones

Aplicación web para predecir resultados del Mundial FIFA 2026 (48 equipos, 104 partidos), con puntuación automática, ranking en **tiempo real** vía WebSockets y panel de administración completo.

| | |
|---|---|
| **Producción** | https://mundial2026-pred-34de76763ecc.herokuapp.com/ |
| **Entrega** | [ENTREGA.md](./ENTREGA.md) · zip: `npm run package-zip` |
| **Deploy** | [HEROKU.md](./HEROKU.md) · [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) (QA local → prod) |
| **Backup y seguridad DB** | [docs/DATABASE_BACKUP_AND_RECOVERY.md](./docs/DATABASE_BACKUP_AND_RECOVERY.md) |
| **Ranking en vivo (perf)** | [docs/RANKING_DASHBOARD_LIVE_PERFORMANCE.md](./docs/RANKING_DASHBOARD_LIVE_PERFORMANCE.md) (FBL-17/18/19) |

## Stack

- **Backend:** Node.js, Express, MongoDB, JWT, WebSockets (`ws`)
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui (zinc)
- **Datos del torneo:** [worldcup26.ir](https://worldcup26.ir/api-docs/) (104 partidos, 48 equipos, estadios)
- **Eventos en vivo y jugadores:** [Football-Data.org](https://www.football-data.org/) (`FOOTBALL_DATA_API_TOKEN`)
- **Deploy:** Heroku (`mundial2026-pred`) + MongoDB Atlas

## Avances del proyecto

Resumen de funcionalidades implementadas (también visible en **Panel admin → Resumen**, debajo de Acciones rápidas).

### Ranking y datos en vivo

- Puntuación y ranking en vivo al arrancar el partido (rescoring periódico).
- Barra de partidos en vivo en `/ranking`: minuto, goleadores, tarjetas y cambios.
- Timeline oficial FIFA en partidos terminados y resumen con stats del reporte PDF.
- Tablas de grupo en vivo con puntos actualizados durante el partido.
- Sync acelerado (15 s) mientras hay partidos `live`; kickoff watch cada 15 s.
- Eventos en vivo vía Football-Data.org (tarjetas, sustituciones).

### Predicciones y puntuación

| Regla | Puntos |
|-------|--------|
| Resultado ganador (incluye empate) | +3 |
| Goles local exactos | +1 |
| Goles visitante exactos | +1 |
| Total de goles (volumen) | +1 |

- Cierre automático **1 h antes** del kickoff; si no hay predicción → **0-0**.
- Punto consuelo (PB): +1 tras 3 partidos seguidos sin puntos; desempate por menor PB.
- Partidos agrupados por fase; equipos resueltos en fase final.
- Agenda ICS (cierre de predicción, tabla del grupo activo).
- Simulación **quick** (demo) y **full** (72 grupos + 32 eliminatorias).

### Mundial, estadios y jugadores

- 48 equipos, 12 grupos FIFA, 104 partidos y 16 estadios con zona horaria IANA.
- Fotos reales de estadios (Wikimedia Commons), popup de detalles y bracket de fase final.
- Tabla de mejores terceros y simulación de fase final en Mis tablas de grupos.
- Historia del Mundial desde Wikipedia; goleadores históricos y 2026.
- **Enciclopedia de Jugadores (Beta):** lineups, lesiones, sync Football-Data.org.
- Broadcasters por partido; fechas en zona horaria del navegador del jugador.

### Grupos de competencia (entre amigos)

- Varios grupos por usuario; ranking **global**, **por grupo** o **sin grupo**.
- Crear, unirse por invitación, premios y cantidad de ganadores.
- Admin del grupo: editar, expulsar miembros, aprobar solicitudes.
- Landing de bienvenida con acceso a Ingresar y Registrarse.

### Panel de administración (`/admin`)

- Setup inicial, login JWT y rutas protegidas.
- Resumen con stats de DB, sync y contadores por estado de partido.
- CRUD de usuarios (contraseña, puntos, perfil), grupos y membresías.
- Edición de partidos, predicciones y recálculo de puntuación.
- Sync manual de partidos y jugadores; simulación en vivo desde admin.
- Predicciones editadas en admin visibles al usuario de inmediato.

## Páginas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Ranking (global, por grupo, sin grupo) + barra de partidos en vivo |
| `/predictions` | Cargar predicciones por fase |
| `/mundial` | Grupos FIFA, fase final, estadísticas, estadios, jugadores (Beta) |
| `/groups` | Grupos de competencia: crear, unirse, premios |
| `/simulation` | Simular torneo (quick / full) |
| `/rules` | Reglas de puntuación y desempates |
| `/admin` | Panel de administración |

## Skills del proyecto

Instaladas en `.agents/skills/`:

- `shadcn` — componentes UI
- `tdd` — desarrollo guiado por tests
- `vercel-react-best-practices` — buenas prácticas React

## Requisitos

- Node.js 20+ (recomendado 24.x)
- MongoDB (local o Atlas)

## Configuración

```bash
cp .env.example .env
# Editar .env: MONGODB_URI, JWT_SECRET, credenciales de sync
```

### API externa (104 partidos, 48 equipos)

Registra un usuario en [worldcup26.ir](https://worldcup26.ir) y configura:

```env
WORLD_CUP_SYNC_EMAIL=tu@email.com
WORLD_CUP_SYNC_PASSWORD=tu_password
```

Opcional — eventos en vivo y enciclopedia de jugadores:

```env
FOOTBALL_DATA_API_TOKEN=tu_token
```

Sin credenciales de sync, la app arranca con **datos demo** (2 partidos de prueba).

## Desarrollo

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- WebSocket: ws://localhost:5000/ws
- Admin: http://localhost:5173/admin

### QA local con copia de producción

Para probar con datos reales (usuarios, predicciones, puntos) sin tocar Atlas:

```bash
cp .env.local-qa.example .env.local-qa   # BACKUP_GITHUB_TOKEN en .env.local-qa
npm run db:clone-from-prod                 # clona backup → mundial2026_local
npm run dev:local-qa                       # banner "QA local" en la UI
curl http://localhost:5000/api/health      # databaseName: mundial2026_local
```

Deploy a prod solo tras checklist: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Tests (puntuación — TDD)

```bash
npm test
```

47+ tests: scoring, leaderboard, PB, grupos, kickoff/zonas horarias, simulación, FIFA timeline, websocket, API client.

## Sync manual

```bash
npm run sync
npm run sync:players          # enciclopedia de jugadores
npm run fix-kickoffs -w backend   # recalcula kickoff UTC si hiciera falta
```

### Datos en vivo (worldcup26.ir + Football-Data)

La API externa actualiza partidos en curso vía `GET /get/games` (polling). Campos relevantes:

| Campo | Uso |
|-------|-----|
| `home_score` / `away_score` | Marcador actual |
| `finished` | `"TRUE"` / `"FALSE"` |
| `time_elapsed` | `"notstarted"`, minuto (`"45"`), `"ht"`, etc. |
| `home_scorers` / `away_scorers` | Goleadores |
| `status` | `live` / `finished` / `upcoming` |

**Jobs del backend:**

| Job | Intervalo default |
|-----|-------------------|
| Sync general | 60 s (`SYNC_INTERVAL_MS`) |
| Sync en ventana live | 15 s (`SYNC_INTERVAL_LIVE_MS`) |
| Kickoff watch + rescoring | 15 s (`KICKOFF_WATCH_MS`) |

**Latencia típica:** el marcador puede tardar hasta ~60 s desde worldcup26.ir (menos durante ventanas live). El ranking provisional se refresca cada 15 s en el frontend cuando hay partidos en curso.

Documentación: [worldcup26.ir/api-docs](https://worldcup26.ir/api-docs/) · [repo worldcup2026](https://github.com/rezarahiminia/worldcup2026)

## Reset y paquete de entrega

```bash
npm run reset-db
npm run package-zip   # crea mundial2026-entrega.zip (sin node_modules ni .env)
```

## Producción

Ver [HEROKU.md](./HEROKU.md) (Heroku + MongoDB Atlas). En cualquier host: `npm run build` y `npm start`; el backend sirve el SPA desde `backend/public`.

```bash
git push heroku main
heroku run npm run sync -a mundial2026-pred
```

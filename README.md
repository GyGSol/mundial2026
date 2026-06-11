# Mundial 2026 — El Juego de Predicciones

Aplicación web para predecir resultados del Mundial 2026, con puntuación automática y ranking en **tiempo real** vía WebSockets.

> **Entrega a otro desarrollador:** ver [ENTREGA.md](./ENTREGA.md) (setup, base de datos, deploy). Generar zip: `npm run package-zip` → `mundial2026-entrega.zip`.

## Stack

- **Backend:** Node.js, Express, MongoDB, JWT, WebSockets (`ws`)
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui (zinc)
- **API de datos:** [rezarahiminia/worldcup2026](https://github.com/rezarahiminia/worldcup2026) → [worldcup26.ir](https://worldcup26.ir/api-docs/)
- **Deploy:** Heroku + MongoDB Atlas

## Skills del proyecto

Instaladas en `.agents/skills/`:

- `shadcn` — componentes UI
- `tdd` — desarrollo guiado por tests
- `vercel-react-best-practices` — buenas prácticas React

## Requisitos

- Node.js 18+
- MongoDB (local o Atlas)

## Configuración

```bash
cp .env.example .env
# Editar .env con MONGODB_URI, JWT_SECRET y credenciales de sync
```

### API externa (104 partidos, 48 equipos)

Registra un usuario en [worldcup26.ir](https://worldcup26.ir) y configura:

```env
WORLD_CUP_SYNC_EMAIL=tu@email.com
WORLD_CUP_SYNC_PASSWORD=tu_password
```

Sin credenciales, la app arranca con **datos demo** (2 partidos de prueba).

## Desarrollo

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- WebSocket: ws://localhost:5000/ws

## Tests (puntuación — TDD)

```bash
npm test
```

Reglas implementadas en `calculatePoints`:

| Regla | Puntos |
|-------|--------|
| Resultado ganador (incluye empate) | +3 |
| Goles local exactos | +1 |
| Goles visitante exactos | +1 |
| Total de goles (volumen) | +1 |

## Sync manual

```bash
npm run sync
npm run fix-kickoffs -w backend   # recalcula kickoff UTC si hiciera falta
```

### Datos en vivo (worldcup26.ir)

La API externa actualiza partidos en curso vía `GET /get/games` (polling, no WebSocket). Campos relevantes del objeto `Game`:

| Campo | Uso |
|-------|-----|
| `home_score` / `away_score` | Marcador actual |
| `finished` | `"TRUE"` / `"FALSE"` |
| `time_elapsed` | `"notstarted"`, minuto (`"45"`), `"ht"`, etc. |
| `home_scorers` / `away_scorers` | Goleadores (string `"null"`, JSON o texto) |
| `status` | Opcional: `live` / `finished` / `upcoming` |

**Qué usa esta app:**

- **Backend:** sync cada `SYNC_INTERVAL_MS` (default 60 s); cada `SYNC_INTERVAL_LIVE_MS` (default 15 s) mientras haya partidos `live`; kickoff watch cada `KICKOFF_WATCH_MS` (15 s) para pasar a `live` y recalcular puntos.
- **API interna:** expone `timeElapsed`, `homeScorers` y `awayScorers` en `/api/matches` (parseados desde `match.raw`).
- **UI:** barra de partidos en vivo en `/ranking` muestra minuto y goleadores cuando la API los envía.

**Latencia típica:** el marcador puede tardar hasta ~60 s en reflejarse desde worldcup26.ir (menos durante ventanas live, 15 s). El ranking provisional se refresca cada 15 s en el frontend cuando hay partidos en curso.

Documentación completa: [worldcup26.ir/api-docs](https://worldcup26.ir/api-docs/) y [repo worldcup2026](https://github.com/rezarahiminia/worldcup2026).

## Reset y paquete de entrega

```bash
npm run reset-db
npm run package-zip   # crea mundial2026-entrega.zip (sin node_modules ni .env)
```

## Producción

Ver [HEROKU.md](./HEROKU.md) (Heroku + MongoDB Atlas). En cualquier host: `npm run build` y `npm start`; el backend sirve el SPA desde `backend/public`.

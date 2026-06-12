# Deploy Heroku — mundial2026-pred

Cuenta: **gonzalomlopolito@gmail.com**

## App creada

| Campo | Valor |
|-------|--------|
| Nombre | `mundial2026-pred` |
| URL | https://mundial2026-pred-34de76763ecc.herokuapp.com/ |
| Región | US |
| Dyno | Basic (web) |
| Stack | Heroku-24 |

## Config vars ya seteadas

- `JWT_SECRET` — generado automáticamente
- `CLIENT_ORIGIN` — URL de la app
- `WORLD_CUP_API_URL` — https://worldcup26.ir
- `SYNC_INTERVAL_MS`, `SYNC_INTERVAL_LIVE_MS`, `KICKOFF_WATCH_MS`, `SIMULATION_ENABLED`, `NODE_ENV`

## Pendiente: MongoDB Atlas

Heroku **no incluye MongoDB**. La app crashea hasta configurar `MONGODB_URI`.

### 1. Crear cluster gratis

1. Entrá a https://cloud.mongodb.com/ (login con `gonzalomlopolito@gmail.com` o Google).
2. **Build a Database** → plan **M0 Free**.
3. Región: **US East** (cerca del dyno Heroku US).
4. Crear usuario de base (usuario + password fuerte).
5. **Network Access** → **Add IP Address** → `0.0.0.0/0` (permite Heroku; dynos cambian IP).

### 2. Copiar connection string

En el cluster → **Connect** → **Drivers** → Node.js.

Formato:

```
mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/mundial2026?retryWrites=true&w=majority
```

(URL-encode caracteres especiales en la password, ej. `@` → `%40`)

### 3. Configurar en Heroku

```bash
heroku config:set MONGODB_URI="mongodb+srv://..." -a mundial2026-pred
```

Opcional (datos reales del mundial):

```bash
heroku config:set \
  WORLD_CUP_SYNC_EMAIL="tu@email.com" \
  WORLD_CUP_SYNC_PASSWORD="tu_password" \
  -a mundial2026-pred
```

### 4. Cargar datos y verificar

```bash
heroku restart -a mundial2026-pred
heroku run npm run sync -a mundial2026-pred
heroku run npm run sync:players -a mundial2026-pred
heroku logs --tail -a mundial2026-pred
curl https://mundial2026-pred-34de76763ecc.herokuapp.com/api/health
curl https://mundial2026-pred-34de76763ecc.herokuapp.com/api/players/meta
```

### Enciclopedia de Jugadores (opcional)

- `FOOTBALL_DATA_API_TOKEN` — token de [Football-Data.org](https://www.football-data.org/) para lineups en vivo e historial de partidos.
- Sin token: se cargan ~1.150 jugadores desde `playersSeed.json` + lesiones desde `playerInjuriesSeed.json` (referencia Transfermarkt).
- Regenerar seed local: `npm run build:players-seed` (requiere `npm run sync` previo para mapear selecciones).
- Sync en producción: `heroku run npm run sync:players -a mundial2026-pred` o `POST /api/admin/sync/players` desde el panel admin.
- UI: pestaña **Jugadores (Beta)** en `/mundial`, a la derecha de Fixture.

### Usuario IA (predicciones Gemini)

El bot `predictivemodeling@gmail.com` predice automáticamente ~90 min antes de cada kickoff (ventana de cierre: 1 h antes).

1. Crear API key gratis en [Google AI Studio](https://aistudio.google.com/apikey).
2. Config vars en Heroku:

```bash
heroku config:set \
  GOOGLE_AI_API_KEY="tu_api_key" \
  AI_PREDICTIONS_ENABLED=true \
  AI_USER_EMAIL="predictivemodeling@gmail.com" \
  -a mundial2026-pred
```

3. Marcar el usuario como IA (una sola vez):

```bash
heroku run npm run mark-ai-user -w backend -a mundial2026-pred
```

4. Verificar en logs (`AI prediction: ...`) ~90 min antes de un partido upcoming.

Variables opcionales: `AI_PREDICT_LEAD_MS` (default 5400000 = 90 min), `AI_PREDICT_WINDOW_MS` (±5 min), `AI_GEMINI_MODEL` (default `gemini-2.0-flash`).

## Deploy de cambios futuros

```bash
cd /home/magnetico/Nexus/Mundial2026
git add .
git commit -m "tu mensaje"
git push heroku main
```

## Panel de administración

**Primer ingreso:** abrí `https://mundial2026-pred-34de76763ecc.herokuapp.com/admin/setup` y creá usuario y contraseña del admin (se guardan hasheados en MongoDB). Solo funciona una vez.

**Ingresos siguientes:** `https://mundial2026-pred-34de76763ecc.herokuapp.com/admin/login`

Opcional en local: `ADMIN_USERNAME` / `ADMIN_PASSWORD` en `.env` (si no están, usá `/admin/setup`).

Desde el panel podés ejecutar sync manual, editar partidos, gestionar usuarios/grupos y usar la simulación.

## Dashboard Heroku

https://dashboard.heroku.com/apps/mundial2026-pred

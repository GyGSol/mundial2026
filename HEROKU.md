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

El bot `predictivemodeling@mundial2026.bot` predice automáticamente ~5 min antes de cada kickoff (ventana de cierre humanos: 1 h antes).

1. Crear API key gratis en [Google AI Studio](https://aistudio.google.com/apikey).
2. Config vars en Heroku:

```bash
heroku config:set \
  GOOGLE_AI_API_KEY="tu_api_key" \
  AI_PREDICTIONS_ENABLED=true \
  AI_USER_EMAIL="predictivemodeling@mundial2026.bot" \
  -a mundial2026-pred
```

3. Marcar el usuario como IA (una sola vez):

```bash
heroku run npm run mark-ai-user -w backend -a mundial2026-pred
```

4. Verificar en logs (`AI prediction: ...`) ~5 min antes de un partido upcoming.

Variables opcionales: `AI_DEFAULT_PROVIDER` (default `cerebras`), `AI_PREDICT_LEAD_MS` (default 300000 = 5 min), `AI_PREDICT_WINDOW_MS` (default 120000 = ±2 min), `CEREBRAS_API_KEY`, `AI_CEREBRAS_MODEL` (default `gpt-oss-120b`), `GOOGLE_AI_API_KEY` / `GROQ_API_KEY` (fallback), `AI_GEMINI_MODEL`, `AI_GROQ_MODEL`.

**Competidor IA (contexto enriquecido):** el bot usa un pipeline distinto al de consultas pagas de usuarios. Opcional para señales de mercado y xG:

```bash
heroku config:set \
  ODDS_API_KEY="..." \
  ODDS_API_SPORT=soccer_fifa_world_cup \
  API_FOOTBALL_KEY="..." \
  API_FOOTBALL_SEASON=2026 \
  -a mundial2026-pred
```

Evaluar precisión rolling (Gdif, sesgo): `heroku run npm run ai:evaluate -w backend -a mundial2026-pred`

### Transmisión en vivo (Fubo Sports Network)

Módulo separado de los broadcasters oficiales. Canales según [fubosportsnetwork.com](https://www.fubosportsnetwork.com/).

**Sin configurar nada**, ya funcionan con URLs oficiales por defecto (YouTube en vivo + enlaces a Tubi, Roku, Fubo app, etc.). Solo override si cambian:

```bash
heroku config:set LIVE_STREAM_ENABLED=true -a mundial2026-pred

# Opcional: solo si querés reemplazar el default
heroku config:set \
  LIVE_STREAM_URL_FUBO_YOUTUBE="https://www.youtube.com/@FuboSports/live" \
  LIVE_STREAM_URL_FUBO_WEB="https://www.fubosportsnetwork.com/" \
  -a mundial2026-pred
```

Variables opcionales: `LIVE_STREAM_URL_FUBO_YOUTUBE`, `LIVE_STREAM_URL_FUBO_WEB`, `LIVE_STREAM_URL_FUBO_APP`, `LIVE_STREAM_URL_FUBO_ROKU`, `LIVE_STREAM_URL_FUBO_TUBI`, `LIVE_STREAM_URL_FUBO_SAMSUNG`, `LIVE_STREAM_URL_FUBO_SLING`, `LIVE_STREAM_URL_FUBO_PRIME`, `LIVE_STREAM_URL_FUBO_PLEX`, `LIVE_STREAM_URL_FUBO_LG`, `LIVE_STREAM_URL_FUBO_VIZIO`, `LIVE_STREAM_URL_FUBO_TCL`, `LIVE_STREAM_URL_FUBO_TABLO`.

- **Embebido en la app:** solo `FUBO_YOUTUBE` (react-player).
- **Resto:** abren app/sitio externo (FAST / Fubo TV).

Endpoint: `GET /api/stream-config?matchId=<externalId>&channelId=<opcional>` — solo si el partido está `live`.

**Nota:** Fubo no publica un `.m3u8` libre; la señal en apps usa DRM/login. No hay `LIVE_STREAM_URL` mágica que saque el partido del Mundial desde Fubo automáticamente.

### Transmisión La18HD (admin, sin redeploy)

Fuente primaria configurable por partido desde el panel admin (`/admin/stream-links`). Solo se muestra cuando el partido está `live` y el usuario tiene sesión iniciada.

**Endpoint autenticado:** `GET /api/matches/:externalId/stream` (Bearer JWT de usuario).

**Sección usuarios:** `/transmissions` — lista los partidos del día (hora Argentina) con estado de señal y botón "Ver transmisión" si el partido está en vivo y tiene URL configurada.

**Endpoint listado:** `GET /api/transmissions/today` (Bearer JWT de usuario).

**Fallback automático:** si el iframe La18HD falla o tarda, la UI muestra Fubo Sports (YouTube `@FuboSports/live`).

**Admin API:**

| Ruta | Acción |
|------|--------|
| `GET /api/admin/stream-links` | Listar mappings |
| `GET /api/admin/transmissions/today` | Partidos de hoy + mapping actual |
| `PUT /api/admin/stream-links/:matchExternalId` | Crear/actualizar URL |
| `DELETE /api/admin/stream-links/:matchExternalId` | Eliminar |
| `GET /api/admin/stream-links/suggest?matchId=` | Sugerencias (scraper opcional) |

Variables opcionales:

```bash
heroku config:set \
  LA18HD_BASE_URL="https://la18hd.com" \
  LA18HD_SCRAPER_ENABLED=false \
  -a mundial2026-pred
```

Flujo operativo:

1. En `/admin/stream-links`, tabla **Partidos de hoy** o formulario manual: asignar `matchExternalId` + URL del evento en [la18hd.com](https://la18hd.com/eventos/).
2. **Auto-mapeo diario:** `npm run sync:streams` lee `/eventos/json/agenda123.json` y upsertea mappings para los partidos de hoy (alias de equipos en español).
3. Los usuarios ven el calendario del día en `/transmissions` (menú **Más → Transmisiones**).
4. Cuando el sync marque el partido como `live`, aparece "Ver transmisión" si hay URL configurada.
5. Actualizar URLs desde admin **no requiere redeploy**.

**Hooks Cursor:** `.cursor/hooks.json` recuerda mapear La18HD al iniciar sesión y sugiere `sync:streams` al terminar cambios en transmisiones.

**Nota:** no guardar URLs `blob:` ni manifests MPD con token expirable; usar la página/evento estable de La18HD.

### Notificaciones push (Web Push / FCM)

Aviso cuando un partido pasa de `upcoming` a `live` (usuarios con predicción cargada y suscripción activa).

Generar claves VAPID (local):

```bash
npx web-push generate-vapid-keys
```

Config en Heroku:

```bash
heroku config:set \
  PUSH_NOTIFICATIONS_ENABLED=true \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:gonzalomlopolito@gmail.com" \
  -a mundial2026-pred
```

Opcional Firebase Cloud Messaging (fase posterior): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — el servicio actual usa Web Push estándar vía `web-push`.

UI: banner de opt-in en `/predictions` → `POST /api/push/subscribe` (requiere login).

### Recuperación de contraseña (jugadores)

Flujo: el jugador pide reset en `/forgot-password` → recibe clave provisoria por email → ingresa → define contraseña nueva en `/change-password`.

**Producción (Gmail SMTP):** crear [contraseña de aplicación](https://myaccount.google.com/apppasswords) en la cuenta emisora (requiere verificación en 2 pasos). Usá la clave de 16 caracteres que genera Google, **no** el texto de ejemplo del doc.

```bash
heroku config:set \
  SMTP_HOST=smtp.gmail.com \
  SMTP_PORT=587 \
  SMTP_USER=gonzalomlopolito@gmail.com \
  SMTP_PASS="abcd efgh ijkl mnop" \
  SMTP_FROM="Mundial 2026 <gonzalomlopolito@gmail.com>" \
  APP_PUBLIC_NAME="Mundial 2026" \
  -a mundial2026-pred
```

Reemplazá `SMTP_PASS` por la contraseña de aplicación real (16 caracteres, sin la contraseña normal de Gmail). Podés pegarla con espacios (`abcd efgh ijkl mnop`); la app los quita sola.

Si en logs aparece `534 Application-specific password required`, estás usando la clave de la cuenta y no una **contraseña de aplicación**. Si aparece `535 BadCredentials`, la clave de aplicación es incorrecta o expiró.

**Local sin SMTP:** si no configurás `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`, el backend loguea la clave provisoria en consola al pedir reset (útil para desarrollo).

Variables: `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (default `SMTP_USER`), `APP_PUBLIC_NAME`.

## Backup automático al finalizar partido (GitHub)

Tras cada pitido final, el backend sube al repo privado de backups:

- `full-database.json.gz` — dump **completo** de MongoDB (todas las colecciones, incl. `passwordHash` para restore total)
- `predictions-export.json` — predicciones en formato legible (como el export FamilyPro)

### 1. Crear repo privado

Ejemplo: `GyGSol/mundial2026-db-backups` (vacío, privado).

### 2. Token fine-grained (GitHub)

- Permiso **Contents: Read and write** solo en ese repo.
- No guardar el token en git ni Engram.

### 3. Config vars en Heroku

```bash
heroku config:set \
  BACKUP_ENABLED=true \
  BACKUP_GITHUB_TOKEN="ghp_..." \
  BACKUP_GITHUB_REPO="GyGSol/mundial2026-db-backups" \
  BACKUP_GITHUB_BRANCH=main \
  -a mundial2026-pred
```

### 4. Probar manualmente

```bash
heroku run "npm run backup:push -w backend" -a mundial2026-pred
```

Deberías ver commits en el repo bajo `backups/YYYY/MM/DD/match-.../`.

### 5. Restaurar desde backup

Descargá `full-database.json.gz` del repo y en local (con `MONGODB_URI` de destino):

```bash
cd backend
DRY_RUN=1 node src/scripts/restoreDatabaseFromBackup.js --file=/ruta/full-database.json.gz
CONFIRM=1 node src/scripts/restoreDatabaseFromBackup.js --file=/ruta/full-database.json.gz
```

Solo predicciones (export legible):

```bash
CONFIRM=1 node src/scripts/restoreFamilyProFromExport.js --file=/ruta/predictions-export.json
```

Estado del último backup: documento `SyncMeta` con clave `matchFinishBackups` en MongoDB.

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

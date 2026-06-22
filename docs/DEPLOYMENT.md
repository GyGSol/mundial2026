# Deploy: QA local → producción

Flujo obligatorio para cambios que afectan UI, API o datos: probar en **localhost** con una copia de la base de producción antes de subir a Heroku.

| Entorno | URL | Base MongoDB |
|---------|-----|--------------|
| QA local | http://localhost:5173 | `mongodb://127.0.0.1:27017/mundial2026_local` |
| Producción | https://mundial2026-pred-34de76763ecc.herokuapp.com/ | Atlas `mundial2026` |

**La base de producción no se toca** durante el clon: solo se descarga un backup de GitHub (solo lectura) y se restaura en tu máquina.

---

## Prerrequisitos

1. **MongoDB local** en `127.0.0.1:27017` (`mongod` corriendo).
2. **Node.js 24.x** y dependencias (`npm install`).
3. **Token GitHub** con lectura en `GyGSol/mundial2026-db-backups` (para clon automático).

---

## Setup inicial (una vez)

```bash
cp .env.local-qa.example .env.local-qa
# Editar .env.local-qa: BACKUP_GITHUB_TOKEN=ghp_...
```

---

## Flujo de trabajo

**Regla para agentes:** antes de ejecutar backup o clon, preguntar al usuario: *¿Querés actualizar la base local con los datos actuales de producción?* No refrescar sin confirmación explícita.

### 1. Clonar prod → local

```bash
npm run db:clone-from-prod
# Vista previa sin descargar/restaurar:
npm run db:clone-from-prod:dry-run
```

Descarga el `full-database.json.gz` más reciente y lo restaura en `mundial2026_local` con `BACKUP_RESTORE_DROP=1`.

**Alternativa manual** (sin token):

```bash
# Descargar full-database.json.gz del repo GyGSol/mundial2026-db-backups
cd backend
MONGODB_URI=mongodb://127.0.0.1:27017/mundial2026_local \
  BACKUP_RESTORE_DROP=1 CONFIRM=1 \
  node src/scripts/restoreDatabaseFromBackup.js --file=/ruta/full-database.json.gz
```

Refrescar el clon cuando necesites usuarios/predicciones al día (p. ej. antes de probar login o puntuación).

### 2. Arrancar QA local

```bash
npm run dev:local-qa
```

- Frontend: http://localhost:5173  
- Backend: http://localhost:5000  
- Banner ámbar: "QA local — datos clonados; no es producción"

### 3. Verificar entorno

```bash
curl http://localhost:5000/api/health
```

Debe responder:

```json
{
  "environment": "local-qa",
  "databaseName": "mundial2026_local",
  "isLocalQa": true,
  "db": "connected"
}
```

Si `databaseName` no es `mundial2026_local` o la URI apunta a Atlas → **detener** y revisar `.env.local-qa`.

### 4. Checklist antes de prod

- [ ] Login jugador/admin con **las mismas credenciales que prod**
- [ ] Feature del cambio probada manualmente
- [ ] `npm test` con `unset MONGODB_URI` (suite verde)
- [ ] Logs locales sin errores críticos
- [ ] Usuario confirma en el chat: "subí a producción"

### 5. Deploy a producción

```bash
git push origin main
CONFIRM_PRODUCTION=1 npm run deploy:production
# o sin variable: npm run deploy:production (pide escribir "production")
```

Verificar:

```bash
curl https://mundial2026-pred-34de76763ecc.herokuapp.com/api/health
```

Rollback si hace falta:

```bash
heroku releases:rollback -a mundial2026-pred
```

**Importante:** no uses `git push heroku main` a mano. El script `deploy:production` mergea `origin/main` sobre `heroku/main` y **excluye `imagenes-jugadores/`** del commit desplegado (Heroku rechaza checkouts >1 GB). Ver [Caricaturas y deploy](#caricaturas-y-deploy).

---

## Caricaturas y deploy

Las caricaturas de jugadores **no van en el slug de Heroku** ni conviene guardar los PNG en MongoDB.

**Guía completa (generar → comprimir → subir):** [PLAYER_PHOTOS.md](./PLAYER_PHOTOS.md)

| Qué | Dónde |
|-----|--------|
| Archivo PNG | Repo GitHub `imagenes-jugadores/` (~100 MB comprimido; **siempre comprimir antes del push**) |
| Referencia | MongoDB `Player.photoKey` (ej. `ecuador/ecu-nilson-angulo.png`) |
| URL en prod | GitHub raw (`PLAYER_PHOTOS_GITHUB_BASE`, default abajo) |
| Manifiesto | `backend/src/data/playerPhotoManifest.json` (PNG publicados en `origin/main`) |
| Servidor local | `/player-photos/` solo en dev/QA (no en `APP_ENV=production`) |

```text
https://raw.githubusercontent.com/GyGSol/mundial2026/main/imagenes-jugadores
```

### Resumen rápido

1. PNG en `imagenes-jugadores/{carpeta}/`
2. **`npm run photos:compress -- {carpeta}`** (obligatorio)
3. `git push origin main` → `npm run photos:build-manifest` → commit manifiesto si cambió
4. `npm run sync:player-photos` (con `MONGODB_URI` de prod)
5. Deploy Heroku solo si cambió backend/manifiesto; opcional `npm run photos:clean-local`

### Sincronizar photoKey en Mongo

Tras agregar PNG en GitHub/local:

```bash
npm run sync:player-photos
```

Eso empareja archivos con jugadores y escribe `photoKey` en Atlas. La app en prod arma la URL con esa clave.

### Avatares de usuario (perfil)

Distinto flujo: la imagen del usuario puede guardarse en Mongo (`User.avatarDataUrl`) y servirse por `/api/users/:id/avatar`. No usar ese campo para caricaturas FIFA.

### `.slugignore` vs git push

- **`.slugignore`:** excluye `imagenes-jugadores/` del **slug** comprimido (~112 MB en prod).
- **Checkout de deploy:** si el commit incluye los PNG, Heroku falla al clonar aunque el slug los ignore después.
- **`npm run deploy:production`:** crea un commit sin esa carpeta y hace push a `heroku` (rama temporal `heroku-deploy-tmp`).

Subí siempre primero a GitHub (`git push origin main`) para que las URLs raw de prod apunten a archivos nuevos.

---

## Tres bases locales

| Base | Uso |
|------|-----|
| `mundial2026_test` | Solo `npm test` |
| `mundial2026` | Dev liviano (`npm run dev` + sync) |
| `mundial2026_local` | QA con datos clonados de prod |

---

## Variables QA vs prod (`.env.local-qa`)

| Variable | QA local | Prod |
|----------|----------|------|
| `MONGODB_URI` | `.../mundial2026_local` | Atlas `.../mundial2026` |
| `APP_ENV` | `local-qa` | (no set / production) |
| `BACKUP_ENABLED` | `false` | `true` |
| `PUSH_NOTIFICATIONS_ENABLED` | `false` | según prod |
| `AI_PREDICTIONS_ENABLED` | `false` | `true` |
| `SMTP_*` | vacío | configurado |

---

## Seguridad

- [`testDbGuard.js`](../backend/src/config/testDbGuard.js): `assertSafeRestoreTarget()` bloquea restore a Atlas.
- **Nunca** `export MONGODB_URI="$(heroku config:get MONGODB_URI ...)"` antes de `npm test`.
- Cambios en `mundial2026_local` **no afectan** prod; el próximo clon los pisa.

Ver también: [DATABASE_BACKUP_AND_RECOVERY.md](./DATABASE_BACKUP_AND_RECOVERY.md), [HEROKU.md](../HEROKU.md).

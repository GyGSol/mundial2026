# Base de datos: backup, recuperación y prevención de pérdida de datos

Documento de referencia para **mundial2026-pred** (Heroku + MongoDB Atlas). Resume el incidente de junio 2026, cómo evitar que se repita, y cómo usar el sistema de backups automáticos.

| Recurso | Valor |
|---------|--------|
| App Heroku | `mundial2026-pred` |
| Repo backups (privado) | `GyGSol/mundial2026-db-backups` |
| Grupo FamilyPro (prod) | `6a1d9d3aec2a89a22a36a279` |
| Export histórico pre-incidente | `backend/data/exports/familypro-predictions-2026-06-15.json` |

---

## 1. Qué pasó (junio 2026)

Tests de integración se ejecutaron con `MONGODB_URI` apuntando a **Atlas de producción**. Varios tests hacen `deleteMany({})` en `users`, `predictions`, `matches`, etc.

**Resultado:** la base quedó casi vacía (solo `stale@example.com`). Nadie podía iniciar sesión; desaparecieron FamilyPro, predicciones y puntos.

### Recuperación aplicada

1. Restaurar usuarios y predicciones desde `familypro-predictions-2026-06-15.json` con `restoreFamilyProFromExport.js`.
2. Corregir partido #1: `externalId` era `finished-only` → debe ser `1` (impedía importar predicciones).
3. Fix en `syncService.js`: no sobrescribir un `externalId` válido con `finished-only`.
4. Completar predicciones faltantes (p. ej. partido #32) y placeholders `0-0` en partidos finished sin predicción (28/28 por humano).
5. Implementar **backup automático a GitHub** al finalizar cada partido.

---

## 2. Reglas para que NO vuelva a pasar

### Para humanos

1. **Nunca** exportar `MONGODB_URI` de Heroku en la misma shell donde corrés `npm test`.
   ```bash
   # Mal — puede borrar producción
   export MONGODB_URI="$(heroku config:get MONGODB_URI -a mundial2026-pred)"
   npm test

   # Bien — tests usan Mongo local de test
   unset MONGODB_URI
   npm test
   ```
2. **Nunca** correr `reset-db`, `restoreDatabaseFromBackup.js` con `CONFIRM=1`, ni scripts de recover contra prod sin leer el script y tener backup reciente.
3. Antes de scripts destructivos en prod, hacer backup manual (ver sección 4).

### Para agentes de Cursor / CI

1. Tests **deben** conectar con `getTestMongoUri()` de [`backend/src/config/testDbGuard.js`](../backend/src/config/testDbGuard.js), nunca `mongoose.connect(process.env.MONGODB_URI)` directo.
2. Vitest carga [`backend/tests/setupTestDb.js`](../backend/tests/setupTestDb.js), que llama `assertSafeTestDatabase()` al inicio.
3. Si `MONGODB_URI` contiene `elalzc2.mongodb.net` o `mundial2026.elalzc2`, los tests **abortan** salvo `ALLOW_PRODUCTION_TEST_DB=1` (solo drills deliberados).
4. URIs que no contienen `test`, `localhost` ni `127.0.0.1` también se rechazan.
5. **No guardar** en Engram: JWT, passwords, `MONGODB_URI`, tokens de GitHub backup, PII.

### Guard técnico

```javascript
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();
await mongoose.connect(mongoUri);
```

Marcadores de producción bloqueados (actualizar si cambia el cluster Atlas):

- `elalzc2.mongodb.net`
- `mundial2026.elalzc2`

---

## 3. Sistema de backup automático

### Cuándo se ejecuta

Tras **recalcular puntuación** de un partido recién `finished`:

- Sync worldcup26 / FIFA ([`syncService.js`](../backend/src/services/syncService.js))
- Cierre de partidos `live` obsoletos ([`kickoffLiveService.js`](../backend/src/services/kickoffLiveService.js))

El backup corre en **background** (no bloquea sync). Si GitHub no está configurado, se omite sin error visible al usuario.

### Qué se sube

Carpeta en el repo de backups:

`backups/YYYY/MM/DD/match-{externalId}-{timestamp}/`

| Archivo | Contenido |
|---------|-----------|
| `full-database.json.gz` | Dump **completo** de MongoDB (todas las colecciones, incl. `passwordHash`) |
| `predictions-export.json` | Predicciones legibles (formato FamilyPro) |

### Deduplicación

`SyncMeta` con clave `matchFinishBackups`: un backup por `matchId` (no repite si el sync dispara varias veces).

### Arquitectura (archivos clave)

| Archivo | Rol |
|---------|-----|
| `backend/src/services/databaseBackupService.js` | Dump JSON + gzip |
| `backend/src/services/tournamentSnapshotService.js` | Export legible |
| `backend/src/services/githubBackupService.js` | GitHub Contents API |
| `backend/src/services/matchFinishBackupService.js` | Orquestador |
| `backend/src/scripts/pushDatabaseBackup.js` | Backup manual |
| `backend/src/scripts/restoreDatabaseFromBackup.js` | Restore total |

### Variables Heroku

| Variable | Ejemplo |
|----------|---------|
| `BACKUP_ENABLED` | `true` |
| `BACKUP_GITHUB_TOKEN` | PAT fine-grained, Contents read/write solo en repo backups |
| `BACKUP_GITHUB_REPO` | `GyGSol/mundial2026-db-backups` |
| `BACKUP_GITHUB_BRANCH` | `main` |

Setup detallado: [HEROKU.md](../HEROKU.md#backup-automático-al-finalizar-partido-github).

---

## 4. Operaciones

### Backup manual (producción)

```bash
heroku run "npm run backup:push -w backend" -a mundial2026-pred
```

**Nota:** usar comillas; `heroku run npm run backup:push` falla con `run: command not found`.

Éxito esperado: log `Manual database backup → GyGSol/mundial2026-db-backups (2 files, N docs)`.

### Restore total (disaster recovery)

1. Descargar `full-database.json.gz` del repo de backups.
2. En local, apuntar `MONGODB_URI` al destino (idealmente cluster de **staging**, no prod sin confirmación).
3. Dry-run:
   ```bash
   cd backend
   DRY_RUN=1 node src/scripts/restoreDatabaseFromBackup.js --file=/ruta/full-database.json.gz
   ```
4. Aplicar:
   ```bash
   CONFIRM=1 node src/scripts/restoreDatabaseFromBackup.js --file=/ruta/full-database.json.gz
   ```

### Restore solo predicciones (FamilyPro)

```bash
cd backend
CONFIRM=1 node src/scripts/restoreFamilyProFromExport.js \
  --file=/ruta/predictions-export.json
```

O desde export histórico:

```bash
CONFIRM=1 node src/scripts/restoreFamilyProFromExport.js \
  --file=data/exports/familypro-predictions-2026-06-15.json
```

### Verificar último backup en MongoDB

Documento en colección `syncmetas` con `key: "matchFinishBackups"` (campo `raw.byMatchId`, `raw.lastError`).

---

## 5. Gotchas conocidos

| Problema | Solución |
|----------|----------|
| `MissingSchemaError: User` en `backup:push` | Script one-off debe importar modelos Mongoose (`pushDatabaseBackup.js` ya lo hace) |
| Backup no aparece en GitHub | Revisar `BACKUP_GITHUB_TOKEN` y permiso Contents write |
| Predicciones no restauran partido #N | Verificar `Match.externalId === 'N'` (no `finished-only`) |
| Placeholders 0-0 inflan puntos en empates | Corregir manualmente en panel admin |
| Tests fallan con “REFUSING production MongoDB” | Correcto — `unset MONGODB_URI` y usar Mongo local |

---

## 6. IDs de referencia FamilyPro (prod)

| Jugador | User ID |
|---------|---------|
| Gisela | `6a1db76595430167a4afc241` |
| Gonzalo | `6a1d9cdeec2a89a22a36a033` |
| Ramdow | `6a205b4e82c32257e3fa6429` |
| Raguccito | `6a21f9a7d64dde09c5ce49a0` |
| Marcelo | `6a1deea195430167a4b09047` |
| Tixe | `6a231b5474b3c1c88ed7c398` |
| Yago | `6a1d9ff0ec2a89a22a36a121` |
| Guido | `6a29fe7df669726d8cdbea37` |
| Jorge | `6a24628774b3c1c88edc6c63` |
| Martin | `6a1f3bdbd66246b92f066559` |
| Tisho | `6a1f9d665cffc04b2a1e8511` |
| IA (Predictive-Modeling) | `6a2b833a3993730b6b456e3e` |

---

## 7. Checklist antes de tocar producción

- [ ] `unset MONGODB_URI` si vas a correr tests
- [ ] Backup reciente en GitHub (`backup:push` o partido finished reciente)
- [ ] Script leído; usar `DRY_RUN=1` primero si existe
- [ ] Cambios de datos documentados en commit / este doc si es procedimiento nuevo

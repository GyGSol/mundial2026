# Mundial 2026 — reglas para agentes

Resumen operativo para humanos y agentes de Cursor. Detalle de setup: [README.md](./README.md), [ENTREGA.md](./ENTREGA.md), [HEROKU.md](./HEROKU.md).

## Proyecto

| Campo | Valor |
|-------|--------|
| Ruta local | `/home/magnetico/Nexus/Mundial2026` |
| App Heroku | `mundial2026-pred` |
| Repo GitHub | `GyGSol/mundial2026` |
| Jira | **FBL** (Nexus-Fubols) — [tablero](https://feelibizaproperties.atlassian.net/jira/software/projects/FBL) |
| Engram (memoria) | proyecto `mundial2026`, datos en `.engram/` |

## Stack

- **Backend:** Node.js, Express, MongoDB, JWT, WebSockets
- **Frontend:** React, Vite, Tailwind, shadcn/ui
- **Datos:** sync con [worldcup26.ir](https://worldcup26.ir) + tarjetas/cambios vía [Football-Data.org](https://www.football-data.org/) (`FOOTBALL_DATA_API_TOKEN`)
- **Deploy:** Heroku + MongoDB Atlas

## Skills del repo

Instaladas en `.agents/skills/` (ver también `skills-lock.json`). Las más usadas en este proyecto:

- `shadcn` — componentes UI
- `tdd` — tests backend
- `vercel-react-best-practices` — rendimiento React
- `deploy-to-vercel` / `vercel-cli-with-tokens` — solo si se despliega fuera de Heroku
- `diagnose` — bugs y regresiones
- `engram-memory` — cuándo/cómo memorizar con Engram (topic_key, juez, secretos)
- `heroku-deploy` — QA local primero, prod solo con confirmación ([docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md))
- `jira-ticket-intake` / `jira-agnt-ticket-unico` / `jira-agnt-bloque-descripcion` — flujo **FBL** y AGNT ([docs/JIRA_SETUP.md](./docs/JIRA_SETUP.md))

Reglas embebidas de skills Vercel (React, composition, view transitions, RN) se cargan vía `AGENTS.md` en cada skill.

## MCP (`.cursor/mcp.json`)

| Servidor | Uso |
|----------|-----|
| `engram` | Memoria persistente del proyecto (sin secretos ni PII) |
| `heroku` | Deploy, logs, config vars de `mundial2026-pred` |
| `context7` | Documentación de librerías |
| `plugin-atlassian-atlassian` | Jira FBL: issues, comentarios, transiciones (OAuth en Cursor) |

Tras editar `mcp.json`: **MCP Reload** en Cursor.

## Convenciones

- Variables sensibles solo en `.env` (nunca en git ni Engram).
- Commits en español o inglés claro; mensaje con el *por qué*.
- **UI en castellano (es-AR)** hasta habilitar i18n: no mostrar textos de APIs externas en inglés; usar `shared/weatherAlertI18n.js` para alertas climáticas.
- **Ranking en vivo (perf):** acordeón, caché en capas y `live-snapshot` — ver [docs/RANKING_DASHBOARD_LIVE_PERFORMANCE.md](./docs/RANKING_DASHBOARD_LIVE_PERFORMANCE.md) (FBL-17/18/19).
- Tests: `npm test` (backend, puntuación y rutas críticas). **Nunca** con `MONGODB_URI` de prod exportada — ver [docs/DATABASE_BACKUP_AND_RECOVERY.md](./docs/DATABASE_BACKUP_AND_RECOVERY.md).
- **Caricaturas:** siempre `npm run photos:compress` antes de `git push` de PNG — ver [docs/PLAYER_PHOTOS.md](./docs/PLAYER_PHOTOS.md).
- **Deploy:** QA local primero → confirmación del usuario → prod. Ver [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). **No** hacer `git push heroku main` sin que el usuario lo pida explícitamente.
- **Jira:** commits/PR con prefijo `FBL-NN:`; estados AGNT **Listo para AGNT** → **Respuesta AGNT** → **Listo**. Inventario backfill: [docs/jira-backfill-inventory.md](./docs/jira-backfill-inventory.md).
- **Base local:** antes de `backup:push` o `db:clone-from-prod`, **preguntar** al usuario si quiere actualizar `mundial2026_local` con los datos actuales de prod. No refrescar sin un sí explícito.

## Base de datos y backups

- Incidente jun-2026: tests con Atlas prod → wipe. Guard: `backend/src/config/testDbGuard.js` + `tests/setupTestDb.js`.
- Backups automáticos al finalizar partido → repo privado `GyGSol/mundial2026-db-backups`.
- Procedimientos: [docs/DATABASE_BACKUP_AND_RECOVERY.md](./docs/DATABASE_BACKUP_AND_RECOVERY.md).

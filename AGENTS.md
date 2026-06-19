# Mundial 2026 — reglas para agentes

Resumen operativo para humanos y agentes de Cursor. Detalle de setup: [README.md](./README.md), [ENTREGA.md](./ENTREGA.md), [HEROKU.md](./HEROKU.md).

## Proyecto

| Campo | Valor |
|-------|--------|
| Ruta local | `/home/magnetico/Nexus/Mundial2026` |
| App Heroku | `mundial2026-pred` |
| Repo GitHub | `GyGSol/mundial2026` |
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

Reglas embebidas de skills Vercel (React, composition, view transitions, RN) se cargan vía `AGENTS.md` en cada skill.

## MCP (`.cursor/mcp.json`)

| Servidor | Uso |
|----------|-----|
| `engram` | Memoria persistente del proyecto (sin secretos ni PII) |
| `heroku` | Deploy, logs, config vars de `mundial2026-pred` |
| `context7` | Documentación de librerías |

Tras editar `mcp.json`: **MCP Reload** en Cursor.

## Convenciones

- Variables sensibles solo en `.env` (nunca en git ni Engram).
- Commits en español o inglés claro; mensaje con el *por qué*.
- Tests: `npm test` (backend, puntuación y rutas críticas). **Nunca** con `MONGODB_URI` de prod exportada — ver [docs/DATABASE_BACKUP_AND_RECOVERY.md](./docs/DATABASE_BACKUP_AND_RECOVERY.md).
- Deploy Heroku: tras cambios implementados, commit + `git push heroku main` + `git push origin main` (sin esperar confirmación del usuario).

## Base de datos y backups

- Incidente jun-2026: tests con Atlas prod → wipe. Guard: `backend/src/config/testDbGuard.js` + `tests/setupTestDb.js`.
- Backups automáticos al finalizar partido → repo privado `GyGSol/mundial2026-db-backups`.
- Procedimientos: [docs/DATABASE_BACKUP_AND_RECOVERY.md](./docs/DATABASE_BACKUP_AND_RECOVERY.md).

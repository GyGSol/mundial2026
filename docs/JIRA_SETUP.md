# Jira — Mundial 2026 (proyecto FBL)

## Datos del espacio

| Campo | Valor |
|-------|--------|
| Sitio | [feelibizaproperties.atlassian.net](https://feelibizaproperties.atlassian.net) |
| Proyecto | **Nexus-Fubols** |
| Clave | **FBL** (`FBL-1`, `FBL-2`, …) |
| Tablero | [FBL board](https://feelibizaproperties.atlassian.net/jira/software/projects/FBL) |
| Repo | [GyGSol/mundial2026](https://github.com/GyGSol/mundial2026) |
| Heroku | `mundial2026-pred` |

## Convenciones de trazabilidad

- Commits y PR: `FBL-NN: descripción` (español o inglés claro).
- Ramas: `feature/FBL-NN-descripcion-corta`.
- Análisis por ticket: `docs/specs/jira-ticket-FBL-NN.md` cuando aplique intake.

## Flujo AGNT (agente Cursor)

Estados en el tablero FBL (nombres exactos para JQL y MCP):

| Estado | Uso |
|--------|-----|
| **Listo para AGNT** | Humano dispara revisión del agente |
| **Respuesta AGNT** | Agente respondió en comentario; espera humano |
| **Listo** | Cierre (incluye backfill retrospectivo) |

Skills: `.cursor/skills/jira-agnt-ticket-unico`, `jira-agnt-bloque-descripcion`, `jira-ticket-intake`.

JQL sugerido: `project = FBL AND status = "Listo para AGNT" ORDER BY updated DESC`.

**Regla:** el resultado del agente va en el **comentario del issue** (`addCommentToJiraIssue`), no solo en el chat de Cursor.

**Puerta de código:** cambios en repo requieren aprobación de **@Gonzalo Lopolito** en el hilo (ver skill `jira-agnt-ticket-unico`).

## MCP Atlassian

Plugin **Atlassian** en Cursor (OAuth). Tras login: `searchJiraIssuesUsingJql`, `createJiraIssue`, `addCommentToJiraIssue`, `editJiraIssue`, `transitionJiraIssue`.

No duplicar en `.cursor/mcp.json` si el plugin global ya expone el servidor.

## GitHub ↔ Jira

1. Org **GyGSol**: GitHub App *Jira Software* con acceso a `mundial2026`.
2. Jira: *GitHub for Atlassian* conectado a GyGSol.
3. Espacio FBL: *Configuración → Cadena de herramientas* → repo `mundial2026`.

Los commits con `FBL-NN` en el mensaje enlazan automáticamente al issue.

## Backfill histórico

Inventario de tickets retrospectivos: [jira-backfill-inventory.md](./jira-backfill-inventory.md).

## Reglas Cursor

Archivos esperados en `.cursor/rules/` (crear si faltan):

- `mundial2026-jira.mdc` — convenciones FBL, flujo AGNT, prefijo `FBL-NN` en commits.
- `jira-comentario-deploy-heroku.mdc` — tras deploy en **mundial2026-pred** (`CONFIRM_PRODUCTION=1`), comentario en ticket activo con release, hash, smoke `/api/health` y bullets de QA. Sin secretos.

## Deploy y comentarios Jira

Tras deploy en **mundial2026-pred** (solo con confirmación explícita; ver [DEPLOYMENT.md](./DEPLOYMENT.md)), publicar comentario en el ticket Jira en contexto (`FBL-NN`) vía MCP `addCommentToJiraIssue`. QA local no requiere comentario salvo que el ticket lo pida.

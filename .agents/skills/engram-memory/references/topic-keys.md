# topic_key — Mundial2026

Convención: `mundial2026/<dominio>/<slug>`. Un slug por tema; re-guardar actualiza.

## Dominios activos (store local, jun-2026)

| Dominio | Temas memorizados | Notas |
|---------|-------------------|--------|
| `mundial2026/ui/` | ranking, predictions, live-match, group-colors, match-timeline, ranking-dashboard-live, **fubols-cup-match-points**, **fubols-cup-mobile** | FBL-25: PTS del cruce + mobile → docs/FUBOLS_CUP.md |
| `mundial2026/streams/` o `mundial2026/stream/` | la18hd-* | **Unificar** en `mundial2026/streams/` |
| `mundial2026/sync/` | knockout-bracket, worldcup26 | Sync worldcup26.ir |
| `mundial2026/backup/` | github, heroku, push-models | Post-partido → GyGSol/mundial2026-db-backups |
| `mundial2026/data-safety/` | test-db-guard, prod-wipe | Nunca `npm test` con Atlas prod |
| `mundial2026/ai/` | cerebras, consultations, prediction-* | IA predicciones |
| `mundial2026/economy/` | fubols, prizes, **prize-distribution** | Premios proporcionales por puesto; IA incluida en reparto proyectado (FBL-22, v637) |
| `mundial2026/deploy/` | heroku | App `mundial2026-pred` |
| `mundial2026/ops/` | jira-workflow, jira-ticket-authoring, jira-judge-rubric, jira-backfill | Jira FBL + MCP Atlassian + flujo AGNT |
| `mundial2026/architecture/` | ranking-predictions-separation | Decisiones estructurales |
| `engram/` | judge-workflow, chat-guide, local-store | Meta-memoria |

## Legacy a no repetir

Migración dejó claves heterogéneas. Al actualizar un tema legacy, **renombrar mentalmente** al formato canónico en el próximo `mem_save` con el mismo contenido:

| Legacy | Canónico sugerido |
|--------|-------------------|
| `sync/knockout-bracket` | `mundial2026/sync/knockout-bracket` |
| `mundial2026/ops/jira-backfill` (solo backfill) | `mundial2026/ops/jira-workflow` |
| `streams/la18hd-*` | `mundial2026/streams/la18hd-*` |
| `stream/la18hd-*` | `mundial2026/streams/la18hd-*` |
| `ui/match-*` | `mundial2026/ui/match-*` |
| `mundial2026-knockout-*` (sin slash) | `mundial2026/ui/knockout-*` o `mundial2026/sync/knockout-*` |

## Slugs nuevos — plantilla

```
mundial2026/<dominio>/<acción-o-componente>

Ejemplos:
  mundial2026/sync/knockout-bracket
  mundial2026/streams/la18hd-mapping
  mundial2026/ui/group-colors
  mundial2026/data-safety/test-db-guard
  mundial2026/ops/jira-workflow
```

## ops/jira — claves Engram (jun-2026)

Proyecto Jira **FBL** (Nexus-Fubols). Buscar con `mem_search "jira workflow FBL"`.

| topic_key | Uso | Memoria ref. |
|-----------|-----|--------------|
| `mundial2026/ops/jira-workflow` | Procedimiento completo agente↔Jira (MCP, estados, backfill, AGNT) | #804 supersedes #803 |
| `mundial2026/ops/jira-ticket-authoring` | Plantilla ticket desde análisis de código (ej. FBL-12) | #806 |
| `mundial2026/ops/jira-judge-rubric` | Rúbrica calidad + mejoras pendientes del proceso | #805 |
| `mundial2026/ops/jira-backfill` | Resumen puntual backfill FBL-1…11 (legacy; preferir jira-workflow) | #803 |

Docs repo: `docs/JIRA_SETUP.md`, `docs/jira-backfill-inventory.md`. Skills: `.cursor/skills/jira-*`.

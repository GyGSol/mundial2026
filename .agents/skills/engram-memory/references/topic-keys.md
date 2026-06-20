# topic_key — Mundial2026

Convención: `mundial2026/<dominio>/<slug>`. Un slug por tema; re-guardar actualiza.

## Dominios activos (store local, jun-2026)

| Dominio | Temas memorizados | Notas |
|---------|-------------------|--------|
| `mundial2026/ui/` | ranking, predictions, live-match, group-colors, match-timeline | Separar ranking vs predicciones |
| `mundial2026/streams/` o `mundial2026/stream/` | la18hd-* | **Unificar** en `mundial2026/streams/` |
| `mundial2026/sync/` | knockout-bracket, worldcup26 | Sync worldcup26.ir |
| `mundial2026/backup/` | github, heroku, push-models | Post-partido → GyGSol/mundial2026-db-backups |
| `mundial2026/data-safety/` | test-db-guard, prod-wipe | Nunca `npm test` con Atlas prod |
| `mundial2026/ai/` | cerebras, consultations, prediction-* | IA predicciones |
| `mundial2026/economy/` | fubols, prizes | Premios proporcionales por puesto |
| `mundial2026/deploy/` | heroku | App `mundial2026-pred` |
| `mundial2026/architecture/` | ranking-predictions-separation | Decisiones estructurales |
| `engram/` | judge-workflow, chat-guide, local-store | Meta-memoria |

## Legacy a no repetir

Migración dejó claves heterogéneas. Al actualizar un tema legacy, **renombrar mentalmente** al formato canónico en el próximo `mem_save` con el mismo contenido:

| Legacy | Canónico sugerido |
|--------|-------------------|
| `sync/knockout-bracket` | `mundial2026/sync/knockout-bracket` |
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
```

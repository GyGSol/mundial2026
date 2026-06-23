---
name: engram-memory
description: Persistent memory with Engram MCP for Mundial2026 — when to save, topic_key taxonomy, session workflow, conflict judging, and secrets policy. Use when starting or ending a session, after bugfixes/decisions/discoveries, when user says "memorizá/guardá en memoria", or when mem_save returns judgment_required.
---

# Engram Memory (Mundial2026)

Store: `ENGRAM_DATA_DIR` → `/home/magnetico/Nexus/Mundial2026/.engram/`  
Project tag: **`mundial2026`** (never `magnetico`).

## Session workflow

### Al iniciar (si la tarea toca contexto previo)

1. `mem_current_project` — confirmar `project: mundial2026` y DB en `.engram/` del repo.
2. `mem_context` o `mem_search` con keywords del área (sync, live, bracket, la18hd, backup…).
3. Si hay `conflict: contested (pending)` en resultados → resolver con `mem_judge` o preguntar al usuario.

### Durante el trabajo — guardar sin esperar

Llamar `mem_save` **de inmediato** tras:

| Evento | `type` sugerido |
|--------|----------------|
| Bug corregido | `bugfix` |
| Decisión de diseño / producto | `decision` |
| Arquitectura o schema | `architecture` |
| Patrón reutilizable | `pattern` |
| Config / deploy / Heroku | `config` |
| Gotcha no obvio | `discovery` o `learning` |

### Al cerrar sesión significativa

`mem_session_summary` con Goal / Instructions / Discoveries / Accomplished / Relevant Files.

## Formato de contenido (obligatorio)

```text
**What**: [qué se hizo, 1–2 líneas]
**Why**: [problema o pedido del usuario]
**Where**: [archivos o rutas concretas]
**Learned**: [gotchas; omitir si no hay]
```

**Título**: corto y buscable — ej. `Fix sync KO 73-104`, `La18HD matcheo español`.

## topic_key (upsert)

Usar **siempre** que el tema pueda actualizarse. Formato canónico:

```text
mundial2026/<dominio>/<slug-kebab>
```

| Dominio | Ejemplos de slug |
|---------|------------------|
| `sync` | `knockout-bracket`, `worldcup26` |
| `streams` | `la18hd-mapping`, `la18hd-policy` |
| `ui` | `knockout-bracket`, `group-colors`, `ranking-live-match` |
| `backup` | `github`, `heroku` |
| `data-safety` | `test-db-guard`, `prod-wipe` |
| `deploy` | `heroku` |
| `economy` | `fubols-prizes` |
| `ai` | `cerebras`, `consultations` |
| `auth` | `password-reset` |
| `ops` | `jira-workflow`, `jira-ticket-authoring`, `jira-backfill` |
| `engram` | `judge-workflow`, `local-store` |

- **Un tema = una clave.** Re-guardar con el mismo `topic_key` actualiza la observación.
- **No** crear variantes (`stream/` vs `streams/`, `fotosparagise` vs `fotos-para-gise`) para el mismo tema.
- Metadatos Engram: `engram/<tema>` (sin prefijo `mundial2026/`).

Registro vivo: [references/topic-keys.md](references/topic-keys.md).

## Qué NO guardar

- `MONGODB_URI`, JWT, passwords, `SMTP_PASS`, API tokens completos
- PII de usuarios (emails, nombres reales de jugadores del pozo)
- Valores de Heroku config vars — solo **nombres** de vars y procedimiento

Si hace falta documentar SMTP o Atlas: describir el flujo sin el secreto.

## Juez de conflictos (`mem_judge`)

Tras `mem_save`, si `judgment_required: true`:

1. Por cada `candidates[]`, llamar `mem_judge` con **su** `judgment_id`.
2. Relaciones: `related` | `compatible` | `scoped` | `supersedes` | `conflicts_with` | `not_conflict`.
3. Preguntar al usuario si `confidence < 0.7` o si `supersedes`/`conflicts_with` en `architecture`/`policy`/`decision`.

Para enlazar dos memorias ya leídas: `mem_compare(memory_id_a, memory_id_b, relation, confidence, reasoning)`.

## Checklist rápido antes de `mem_save`

- [ ] ¿Aporta valor a una sesión futura? (si es obvio del código, no guardar)
- [ ] ¿Título claro + formato What/Why/Where?
- [ ] ¿`topic_key` bajo `mundial2026/...`?
- [ ] ¿Sin secretos ni PII?
- [ ] ¿`type` correcto?

## CLI local (verificación)

```bash
ENGRAM_DATA_DIR=/home/magnetico/Nexus/Mundial2026/.engram engram stats
ENGRAM_DATA_DIR=/home/magnetico/Nexus/Mundial2026/.engram engram search "tema" --project mundial2026
```

Tras editar `.cursor/mcp.json`: **MCP Reload** en Cursor.

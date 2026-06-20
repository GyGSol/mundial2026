---
name: heroku-deploy
description: Deploy Mundial 2026 to Heroku with local QA first. Use when deploying, pushing to production, or after implementing features that need verification before prod.
---

# Heroku deploy — local QA first

Proyecto: **mundial2026-pred** (producción). **No hay staging Heroku.** Probar siempre en localhost con copia de la base antes de prod.

Documentación completa: [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)

## Reglas duras

1. **Nunca** `git push heroku main` sin confirmación explícita del usuario en el chat ("sí", "deploy prod", "subí a producción").
2. Tras implementar cambios → commit → `git push origin main`.
3. Si el cambio afecta UI/API/DB → `npm run db:clone-from-prod` (si datos desactualizados) + `npm run dev:local-qa`.
4. Verificar `curl http://localhost:5000/api/health` → `databaseName: mundial2026_local`, `environment: local-qa`.
5. Reportar checklist al usuario y **preguntar** antes de prod.
6. Prod solo con `CONFIRM_PRODUCTION=1 npm run deploy:production` o confirmación interactiva del script.
7. **Nunca** `npm test` con `MONGODB_URI` de Atlas/Heroku — `unset MONGODB_URI` primero.
8. Scripts destructivos (`restore`, `reset-db`) solo contra `mundial2026_local` o `mundial2026_test`.

## Flujo

```
implementar → commit → push origin
→ db:clone-from-prod (si hace falta)
→ dev:local-qa → health check → checklist → usuario confirma
→ CONFIRM_PRODUCTION=1 npm run deploy:production
→ curl prod /api/health
```

## Comandos

| Comando | Acción |
|---------|--------|
| `npm run db:clone-from-prod` | Clonar backup prod → `mundial2026_local` |
| `npm run dev:local-qa` | Dev con `.env.local-qa` |
| `npm run deploy:production` | Push Heroku prod (con confirmación) |
| `unset MONGODB_URI && npm test` | Tests seguros |

## Producción no se toca en QA

El clon **lee** GitHub backups y **escribe** solo en `127.0.0.1/mundial2026_local`. Atlas prod queda intacto.

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
3. **Preguntar siempre** antes de refrescar la base local: *"¿Querés actualizar la base local con los datos actuales de producción?"* — **no** correr `backup:push` ni `db:clone-from-prod` sin un **sí** del usuario.
4. Si el usuario confirma refresco: `heroku run "npm run backup:push -w backend" -a mundial2026-pred` → `npm run db:clone-from-prod`.
5. Si el cambio afecta UI/API/DB → `npm run dev:local-qa` (con o sin refresco previo, según respuesta del usuario).
6. Verificar `curl http://localhost:5000/api/health` → `databaseName: mundial2026_local`, `environment: local-qa`.
7. Reportar checklist al usuario y **preguntar** antes de prod.
8. Prod solo con `CONFIRM_PRODUCTION=1 npm run deploy:production` o confirmación interactiva del script. **No** `git push heroku main` manual (ver [DEPLOYMENT.md](../../docs/DEPLOYMENT.md) — caricaturas).
9. **Nunca** `npm test` con `MONGODB_URI` de Atlas/Heroku — `unset MONGODB_URI` primero.
10. Scripts destructivos (`restore`, `reset-db`) solo contra `mundial2026_local` o `mundial2026_test`.

## Cuándo preguntar por refresco de base local

- Al iniciar QA local o levantar `dev:local-qa` para probar un cambio.
- Cuando el cambio toque login, usuarios, predicciones, puntuación, grupos o admin.
- **No** preguntar en cada mensaje si ya refrescaste en la misma sesión y el usuario dijo que no — respetar esa decisión hasta que pida otro cambio o lo vuelva a pedir.

## Flujo

```
implementar → commit → push origin
→ preguntar: ¿actualizar base local desde prod?
   → si sí: backup:push → db:clone-from-prod
→ dev:local-qa → health check → checklist → usuario confirma prod
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

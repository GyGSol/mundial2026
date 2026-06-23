---
name: jira-ticket-intake
description: Analyze Jira ticket comments at the start of work, extract business rules and constraints, identify missing decisions for implementation, and document outcomes in docs/. Lee el bloque AGNT en la descripcion si existe (jira-agnt-bloque-descripcion). Use when a task references a Jira URL/key (FBL-NN) or asks to start work from a Jira ticket.
---

# Jira Ticket Intake

## Ecosistema Mundial 2026

El intake y la documentación en `docs/` describen requisitos de **Mundial 2026 Predicciones** (GyGSol), proyecto Jira **FBL**.

## Objetivo

Antes de implementar, convertir comentarios del ticket Jira en insumo técnico trazable: hechos confirmados, reglas de negocio, vacíos de información y documentación actualizada.

## Flujo obligatorio

1. Leer issue completo y comentarios del ticket.
   - En la descripcion, separar texto **humano** del apartado final **`## AGNT`** (skill `jira-agnt-bloque-descripcion`): usar AGNT como briefing operativo y validar contra el hilo.
2. Extraer:
   - hechos confirmados del negocio;
   - reglas de negocio explícitas;
   - restricciones técnicas y operativas;
   - decisiones faltantes/bloqueantes.
3. Clasificar cada punto como:
   - `confirmado`,
   - `parcial`,
   - `faltante`.
4. Actualizar documentación del repositorio:
   - documento específico del ticket en `docs/` (ej. `docs/specs/jira-ticket-FBL-5-brief-analysis.md`);
   - ajustes en `docs/data-model.md` si cambian decisiones abiertas.
5. Mantener trazabilidad:
   - incluir clave Jira (`FBL-NN`) en texto de documentación y commits/PR.
6. Tras el intake, **actualizar o crear** el bloque **`## AGNT`** en la descripcion del issue (mismos campos OBJ/CTX/EVOL/ACT/DEPS del skill `jira-agnt-bloque-descripcion`), salvo que el usuario pida solo documentacion en `docs/` sin tocar Jira.

## Regla de calidad mínima

- No asumir decisiones fiscales, de PII o de conciliación si no están explícitas.
- Si un punto crítico no está definido, marcarlo como `faltante` y explicar riesgo técnico.
- Priorizar bloqueantes de MVP (3-5) cuando aplique.

## Plantilla de salida recomendada

Usar esta estructura en el documento de análisis del ticket:

1. Información confirmada.
2. Respuestas parciales.
3. Datos faltantes/bloqueantes.
4. Impacto técnico de faltantes.
5. Próxima acción recomendada.

## Contexto Mundial 2026

- Predicciones, puntuación y ranking en vivo son núcleo; ver `README.md` y `ENTREGA.md`.
- UI en castellano (es-AR); alertas climáticas vía `shared/weatherAlertI18n.js`.
- Tests: nunca `MONGODB_URI` de prod; ver `docs/DATABASE_BACKUP_AND_RECOVERY.md`.
- Deploy: QA local → confirmación usuario → prod (`docs/DEPLOYMENT.md`).

## PRD (salida estructurada)

Cuando el ticket deba convertirse en PRD:

1. Completar el flujo obligatorio de arriba.
2. Escribir en `docs/specs/PRD-{CLAVE_JIRA}-{slug}.md` con criterios Dado/Cuando/Entonces.
3. No copiar PII ni correos de comentarios Jira al PRD.

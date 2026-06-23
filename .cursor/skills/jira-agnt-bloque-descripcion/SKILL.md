---
name: jira-agnt-bloque-descripcion
description: Mantiene el apartado AGNT al final de descripciones y comentarios Jira en FBL (briefing denso para el agente, acciones recomendadas, evolución del ticket). Usar al leer, crear o actualizar issues, al redactar comentarios con posibles soluciones, o tras intake/Resultado AGNT. Complementa jira-agnt-ticket-unico y jira-ticket-intake.
---

# Jira — bloque AGNT en descripción y comentarios (Mundial 2026)

## Objetivo

En cada ticket **FBL** (y equivalentes del proyecto Mundial 2026), el agente mantiene un apartado fijo **`AGNT`** al **final** de la **descripción** del issue y, cuando aporte valor, al final de **comentarios** que introduzcan alcance nuevo o replanteen el trabajo. Ese texto está pensado para **lectura del agente** en la siguiente pasada: no hace falta que sea legible para humanos; debe ser **denso, estructurado y accionable**.

El flujo **Listo para AGNT → Resultado AGNT → Respuesta AGNT** y las plantillas de `jira-agnt-ticket-unico` **no cambian**. Este skill añade la **capa de briefing persistente** en el cuerpo del ticket.

## Cuándo usar

- Al **leer** un ticket (intake, comando `JIRA FBL-NN`, revisión en **Listo para AGNT**).
- Al **crear** o **ampliar** la descripción de un issue (humano o agente).
- Tras **analizar** descripción + comentarios y antes o después de publicar **Resultado AGNT**.
- Al redactar un **comentario** que proponga alcance, alternativas o cierre parcial (añadir sub-bloque AGNT al final del comentario).
- Cuando el agente detecte que conviene otra vuelta en **Listo para AGNT** (solo **sugerir**; ver más abajo).

## Convención de marcado

| Ubicación | Formato |
|-----------|---------|
| Descripción del issue | Bloque al **final**, separado del texto humano. Encabezado exacto en una línea: `## AGNT` |
| Comentario (opcional) | Misma regla al final del comentario: `## AGNT` solo si el comentario añade contexto que la próxima ejecución deba leer sin re-parsear todo el hilo |

**Regla de no pisar:** el contenido **encima** de `## AGNT` es para personas (objetivo, criterios, negocio). El bloque AGNT **no sustituye** esa parte; la **complementa** para el agente.

Si ya existe `## AGNT`, **reemplazar solo ese bloque** (desde el encabezado hasta el final de la descripción), preservando todo lo anterior.

## Lectura (prioridad al trabajar el ticket)

1. Leer la descripción humana (sin depender solo del bloque AGNT).
2. Si existe `## AGNT`, tratarlo como **briefing operativo**: objetivo comprimido, acciones sugeridas, evolución y señales del hilo.
3. Cruzar con comentarios en orden cronológico; si un comentario reciente tiene su propio `## AGNT`, fusionar mentalmente (el de la descripción suele ser la **fuente canónica**; actualizarla tras cambios relevantes en el hilo).
4. Aplicar `jira-ticket-intake` y `jira-agnt-ticket-unico` sobre el conjunto (descripción + AGNT + comentarios + **Pregunta AGNT** + **Pregunta al equipo AGNT**).
5. Si existe comentario **`Pregunta al equipo AGNT`** sin respuesta humana posterior, reflejar en **DEPS** `faltante:pendiente-equipo` y no asumir aprobación para **PUERTA** `repo:si-aprobado`.

## Escritura y actualización en Jira

Usar MCP Atlassian:

- **Descripción:** `editJiraIssue` con `fields.description` (o campo equivalente del proyecto), `contentFormat: markdown` si está soportado.
- **Comentarios:** `addCommentToJiraIssue` con el cuerpo humano primero y `## AGNT` al final cuando corresponda.

**Cuándo actualizar el bloque en la descripción (obligatorio si el agente tocó el ticket con análisis):**

- Tras intake o análisis nuevo del hilo.
- Tras publicar **Resultado AGNT** si cambió el entendimiento, las acciones recomendadas o la evolución.
- Al crear una issue nueva donde el agente redacte o complete la descripción.

**Cuándo NO duplicar:** no pegar el mismo bloque AGNT íntegro en cada comentario rutinario; basta **Resultado AGNT** legible para humanos + **refresco del bloque en la descripción**.

## Formato del bloque AGNT (plantilla)

Usar **español técnico abreviado** o etiquetas fijas; frases cortas; listas; sin PII ni secretos. Versión del esquema en la primera línea del bloque.

```markdown
## AGNT

`agnt-v1` · `FBL-NN` · `rev:<YYYYMMDD-HHmm UTC>` · `estado:<nombre Jira>`

**OBJ** — Una línea: qué debe quedar resuelto en este ticket.

**CTX** — Contexto comprimido (alcance, restricciones, enlaces docs/repo si aplica; sin repetir párrafos humanos).

**EVOL** — Evolución del ticket en 3–8 bullets: creación, transiciones relevantes, comentarios clave (autor/fecha resumida), Resultados AGNT previos, repreguntas abiertas.

**ACT** — Acciones recomendadas para el agente (orden sugerido):
1. `[P0]` …
2. `[P1]` …
3. `[P2]` …

**DEPS** — Bloqueantes / faltantes (`confirmado` | `parcial` | `faltante`); referencia a docs o ADR si existe.

**SIG** — Qué leer o ejecutar en la próxima pasada (rutas `docs/`, skills, comandos smoke, etc.).

**PUERTA** — `repo:no` | `repo:si-aprobado` | `repo:pendiente-aprobacion` (alineado con plantilla Puerta de código en `jira-agnt-ticket-unico`).
```

Ajustar densidad al tamaño del ticket; nunca omitir **OBJ**, **EVOL** y al menos una línea en **ACT**.

## Comentarios con posibles soluciones

A partir de esta convención, cuando el agente (o quien redacte en su nombre) deje en Jira **propuestas de solución, alternativas o análisis** que deban alimentar la siguiente ejecución:

1. Redactar la parte **legible para el equipo** (Resultado AGNT, respuesta a pregunta, etc.) según `jira-agnt-ticket-unico`.
2. Actualizar **`## AGNT` en la descripción** con el estado tras ese comentario.
3. Opcional: en comentarios **muy largos** o que reemplacen temporalmente la descripción, un `## AGNT` breve al final del comentario con solo **delta** (`rev` + cambios desde la última revisión); luego consolidar en la descripción.

## Sugerir «Listo para AGNT» (sin automatizar)

La configuración anterior sigue igual: **solo el humano** mueve el ticket a **Listo para AGNT** para disparar la revisión completa en Cursor.

Si el agente considera que **conviene otra vuelta** del agente en el ticket:

- **No** ejecutar `transitionJiraIssue` a Listo para AGNT por iniciativa propia.
- **Sí** indicarlo de forma explícita en:
  - el bloque **SIG** o una línea **`NEXT`** dentro de `## AGNT` (ej. `NEXT: humano → Listo para AGNT cuando valide X`), y/o
  - la sección **5) Siguiente paso sugerido** del comentario **Resultado AGNT**, con frase del tipo: *«Recomendación: pasar a Listo para AGNT cuando …»*.

El usuario decide si aplica el cambio de estado.

## Guardrails

- **PII:** no nombres, emails, teléfonos ni documentos de huéspedes en AGNT; usar IDs técnicos o «dato en sistema X».
- **Secretos:** no tokens, URLs con credenciales ni `DATABASE_URL`.
- **No borrar** texto humano al actualizar AGNT.
- **Trazabilidad:** incluir clave `FBL-NN` en el bloque; alinear **PUERTA** con gobierno de cambios en repo (`@Gonzalo Lopolito`, skill ticket único).
- Si `editJiraIssue` falla por permisos, dejar el bloque AGNT propuesto en el **comentario** (Resultado AGNT) y pedir al humano que lo pegue en la descripción.

## Pregunta al equipo (sincronía con comentarios)

Si el agente publicó **`Pregunta al equipo AGNT`** (@Gonzalo Lopolito), actualizar el bloque:

- **DEPS** — incluir `faltante:pendiente-equipo` + resumen de qué falta (sin PII).
- **ACT** — primera línea: `[P0] Esperar respuesta en hilo a Pregunta al equipo AGNT; no repo hasta entonces.`
- **NEXT** — `humano → Listo para AGNT tras respuesta de @Gonzalo Lopolito.`

Tras respuesta humana, refrescar **EVOL** con cita autor/fecha y bajar prioridad de pendiente-equipo.

Detalle y plantilla: skill `jira-agnt-ticket-unico` (sección *Pregunta al equipo AGNT*).

## Relación con otras skills

| Skill | Rol |
|-------|-----|
| `jira-agnt-ticket-unico` | Ejecución en **Listo para AGNT**, Resultado AGNT, **Pregunta al equipo AGNT**, transición a **Respuesta AGNT** |
| `jira-ticket-intake` | Clasificación confirmado/parcial/faltante; alimenta **DEPS** y **CTX** del bloque AGNT |
| `mundial2026-jira` | Convenciones FBL y estados AGNT en el tablero |

## Ejemplo mínimo (descripción tras análisis)

```markdown
Como operaciones, necesito exportar reservas del mes sin datos personales en el CSV.

Criterios: …

## AGNT

`agnt-v1` · `FBL-42` · `rev:2026-05-23-1430 UTC` · `estado:En curso`

**OBJ** — Definir e implementar export CSV agregado sin PII para operaciones.

**CTX** — Ledger en céntimos; PII solo guest_profile; ver docs/data-model.md §export.

**EVOL** — Creado 2026-05-20; comentario humano 2026-05-22 pide ajuste de alcance; sin Resultado AGNT aún.

**ACT**
1. `[P0]` Intake: confirmar columnas permitidas vs prohibidas (PII).
2. `[P1]` Borrador endpoint o script con pseudónimos de reserva_id.
3. `[P2]` Puerta de código si toca repo — esperar @Gonzalo Lopolito.

**DEPS** — `faltante`: formato fecha y moneda en CSV.

**SIG** — docs/specs/ si existe PRD; skill jira-ticket-intake.

**PUERTA** — `repo:pendiente-aprobacion`

**NEXT** — humano → Listo para AGNT tras cerrar columnas en comentario.
```

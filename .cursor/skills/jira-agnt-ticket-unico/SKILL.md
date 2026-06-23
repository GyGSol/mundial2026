---
name: jira-agnt-ticket-unico
description: Flujo Jira de ticket unico para agente en Mundial 2026. Dispara trabajo cuando el ticket esta en Listo para AGNT, responde en comentario del mismo ticket y mueve a Respuesta AGNT. Lee y actualiza el bloque AGNT en la descripcion (skill jira-agnt-bloque-descripcion).
---

# Jira AGNT ticket unico (Mundial 2026)

## Ecosistema Mundial 2026

Comentarios y transiciones Jira del agente identifican el producto como **Mundial 2026 Predicciones** (GyGSol / repo `mundial2026`).

## Regla de entrega (no negociable)

- **Nunca** dar por cumplido un ticket **Listo para AGNT** respondiendo **solo** en el chat de Cursor. La salida que valga como **Resultado AGNT** debe **publicarse en el issue** con `addCommentToJiraIssue` y, salvo bloqueo técnico (MCP caido, sin permisos), **transicionar** a **Respuesta AGNT** como indica este skill.
- El chat puede repetir o resumir, pero **no sustituye** el comentario en Jira.
- **Si hace falta tocar codigo o el repo:** igualmente **primero** el comentario en Jira (Resultado AGNT o plantilla **Puerta de codigo**); el trabajo en git va **después** y segun aprobacion del hilo, no al reves.
- **Si el pedido no implica cambiar codigo:** la solucion **completa** va en el **comentario del ticket** (plantilla **Resultado AGNT** o **Respuesta a Pregunta AGNT**), no resumida solo en el chat de Cursor.

## Objetivo

Eliminar la dependencia de subtareas AGT y operar todo el ciclo de trabajo del agente en un unico ticket Jira.

## Cuando usar

- Usuario pide "revisar Jira", "ticket listo para AGNT", "contestar ticket con agente".
- Hay tickets en estado **Listo para AGNT** en el proyecto `FBL`.
- Se requiere iterar por comentarios del mismo issue sin abrir subtareas.
- El usuario pide revisar Jira / contestar tickets desde Cursor (no solo texto para copiar).

## Desde Cursor (automatico, sin pegar a mano)

Cuando el usuario pida **revisar Jira** o **contestar** tickets en **Listo para AGNT**:

1. Buscar issues con JQL (MCP Atlassian o script local).
2. Por cada ticket:
   - **Leer todos los comentarios** en orden cronologico (de mas antiguo a mas reciente para el hilo).
   - **Heuristica Resultado AGNT:** los comentarios que son **salida del agente** (p. ej. encabezado **Resultado AGNT**) **no** son la pregunta activa de una nueva vuelta. Sirven de contexto del hilo, pero la **pregunta a responder** esta en comentarios marcados **Pregunta AGNT** (o equivalente claro). No volver a **contestar** un **Resultado AGNT** anterior como si fuera el pedido nuevo.
   - Si hay una **Pregunta AGNT** en comentarios **sin respuesta del agente que la cite**, **priorizar** contestar esas preguntas (ver seccion **Comentarios: Pregunta AGNT**); no bastar con responder solo la descripcion del ticket.
   - **Sin puerta de codigo:** redactar la respuesta, **publicar comentario** con `addCommentToJiraIssue` (`contentFormat: markdown`), obtener transiciones con `getTransitionsForJiraIssue` y ejecutar `transitionJiraIssue` hacia **RESPUESTA AGNT**.
3. Si **si** aplica puerta de codigo: solo comentario con plantilla «Puerta de codigo» y mencion a **@Gonzalo Lopolito**; **no** transicionar a trabajo hecho ni implementar hasta aprobacion en el hilo.

No pedir al usuario que pegue el comentario si las herramientas MCP de Jira estan disponibles y autorizadas.

## Flujo operativo

1. Buscar tickets pendientes:
   - JQL sugerido: `project = FBL AND status = "Listo para AGNT" ORDER BY updated DESC`.
2. Tomar un ticket y leer:
   - descripcion completa (parte humana + bloque **`## AGNT`** al final si existe; ver skill `jira-agnt-bloque-descripcion`);
   - **comentarios completos**, en orden **cronologico** (antiguo → reciente) para entender el hilo;
   - detectar comentarios con **Pregunta AGNT** pendiente de respuesta (ver seccion siguiente);
   - adjuntos/enlaces relevantes si existen.
3. **Si hay Pregunta AGNT sin resolver en el hilo:** la salida del agente debe ser un **nuevo comentario** que **referencie explicitamente** esa pregunta (autor, fecha o cita breve) y **responder** punto por punto. No omitir esto aunque la descripcion del ticket sea distinta.
4. Ejecutar intake (cuando aplique al conjunto descripcion + comentarios):
   - hechos confirmados;
   - reglas de negocio;
   - restricciones;
   - faltantes/bloqueantes.
5. Clasificar el pedido:
   - **Solo informacion / alineacion / sin tocar repo:** responder en comentario con la plantilla AGNT habitual; si hubo **Pregunta AGNT**, usar la plantilla **Respuesta a Pregunta AGNT** (o incluir su bloque Referencia obligatoria dentro del comentario).
   - **Requiere cambios en codigo o archivos versionados del repo:** **no** implementar todavia; **no** dar por cerrada la respuesta tecnica como si ya estuviera hecho en el codigo. Ir directo a la **plantilla "Puerta de codigo"** (abajo). Si la **Pregunta AGNT** mezcla dudas y pedido de codigo, responder la parte dudas y abrir puerta de codigo para la parte repo.
6. Transicionar ticket a **Respuesta AGNT**.
7. **Actualizar** el bloque **`## AGNT`** en la descripcion del issue (`editJiraIssue`) con OBJ/EVOL/ACT/DEPS/SIG tras el analisis; si falla MCP, incluir el bloque propuesto al final del comentario Resultado AGNT.
8. Si hay nueva repregunta humana en comentarios, el **humano** vuelve a **Listo para AGNT** y se repite. El agente **no** transiciona a Listo para AGNT por su cuenta; solo **sugiere** en Resultado AGNT o en **NEXT** del bloque AGNT (skill `jira-agnt-bloque-descripcion`).

## Comentarios: Pregunta AGNT (obligatorio)

Convencion en el hilo del ticket (recomendado para humanos y equipo):

- Marcar preguntas dirigidas al agente con una linea o bloque claro, por ejemplo: **`Pregunta AGNT:`** seguido del texto de la pregunta (puede haber varios items).

Reglas para el agente cuando el estado es **Listo para AGNT**:

0. Al triage del hilo, **identificar** comentarios de salida del agente (**Resultado AGNT**, variantes *seguimiento*, etc.): son **contexto**, no nuevas preguntas. Un **Resultado AGNT** posterior a una **Pregunta AGNT** **no** cierra esa pregunta si **no** la referencia con el bloque *En respuesta a Pregunta AGNT* (o cita equivalente).
1. Recorrer los comentarios en orden **cronologico** y localizar la **ultima** (o todas las) **Pregunta AGNT** que **aun no tengan** un comentario posterior del agente que diga explicitamente que responde a esa pregunta (p. ej. encabezado *En respuesta a Pregunta AGNT de…*).
2. **Siempre** contestar con un **nuevo comentario** que incluya:
   - **Referencia obligatoria:** quien pregunto (display name si consta), **fecha del comentario** si la ves en la API/UI, y/o **cita breve** (una frase) de la **Pregunta AGNT** a la que respondes.
   - **Respuesta** clara a cada punto de esa pregunta.
3. Si solo existe pedido en la **descripcion** y **no** hay **Pregunta AGNT** en comentarios, se responde al alcance de la descripcion con la plantilla AGNT habitual.
4. Si hay **tanto** descripcion **como** **Pregunta AGNT** pendiente, **no** omitir la **Pregunta AGNT**; el comentario puede enlazar ambos (*Ademas de la descripcion…* + *En respuesta a Pregunta AGNT…*).

## Comentarios: Pregunta al equipo AGNT (agente → humanos)

Cuando el agente **necesite decision de negocio, fiscal, alcance o aprobacion** antes de aplicar cambios (repo, cierre de diseno, migraciones, etc.) y **no** pueda inferirlo del hilo:

1. **No** implementar ni commitear hasta respuesta en Jira.
2. Publicar comentario con encabezado exacto **`Pregunta al equipo AGNT`** (distinto de **`Pregunta AGNT`**, que es humano → agente).
3. **Mencionar siempre** en la primera linea del cuerpo (notificacion Jira):
   - **@Gonzalo Lopolito** — gobierno técnico, aprobación de cambios en repo y priorización de ingeniería.
4. Listar preguntas **numeradas**, concretas y contestables (si/no, opcion A/B, fecha, responsable).
5. Indicar **que hara el agente tras la respuesta** (siguiente paso en repo o en docs).
6. Transicionar a **Respuesta AGNT** (igual que Resultado AGNT) y actualizar bloque **`## AGNT`** en descripcion: marcar **DEPS** con `faltante:pendiente-equipo` y **ACT** con espera de comentario citado.
7. En la **siguiente** pasada en **Listo para AGNT**, si hay respuesta humana posterior a esa pregunta, tratarla como input prioritario (citar autor/fecha) antes de aplicar.

**Cuando usar @Gonzalo solo vs ambos:**

| Tipo de duda | Mencionar |
|--------------|-----------|
| Aprobación repo, arquitectura, stack, Heroku, deploy prod | @Gonzalo Lopolito |
| Alcance de producto / prioridades de features | @Gonzalo Lopolito |
| Puerta de código ya abierta | @Gonzalo Lopolito |

### Plantilla «Pregunta al equipo AGNT»

```text
Pregunta al equipo AGNT

@Gonzalo Lopolito

Antes de aplicar cambios en el repositorio / cerrar esta decision, necesito confirmacion:

1) <pregunta concreta>
2) <pregunta concreta>

Contexto breve:
- <por que bloquea el avance>

Tras vuestra respuesta en este hilo:
- <accion que ejecutara el agente, p. ej. PR, actualizar docs/specs, puerta de codigo>

Estado: dejo el ticket en Respuesta AGNT; cuando respondais, @Gonzalo Lopolito o quien corresponda puede pasar a Listo para AGNT para la siguiente vuelta del agente.
```

## Regla respuesta vs cambios en codigo (gobierno Mundial 2026)

- **Por defecto:** siempre dejar un **comentario** en Jira y pasar a **RESPUESTA AGNT**.
- **Si desde Jira el pedido implica cambiar el proyecto (codigo, configs en git, docs obligadas por el ticket, etc.):**
  - **No** aplicar commits ni cambios en el repo en esa misma interaccion salvo que en el hilo exista **aprobacion explicita** de **@Gonzalo Lopolito** para proceder (o el ticket diga ya aprobado por el).
  - **No** "contestar" con la solucion implementada ni con un diseno cerrado presentado como hecho en codigo: limitarse a **explicar el alcance propuesto**, archivos/areas afectadas, riesgos breves y que falta definir.
  - En el comentario, **mencionar siempre a @Gonzalo Lopolito** para que **decida** si se sigue adelante con el cambio (usar la mencion de usuario de Jira para que le llegue notificacion).
- **Tras aprobacion en comentario:** cuando **@Gonzalo Lopolito** confirme (p. ej. "aprobado implementar"), se puede volver el ticket a **Listo para AGNT** o ejecutar el trabajo en Cursor segun acuerdo del equipo; ahi si aplican commits/PR con clave `FBL-XX`.

## Plantilla de comentario AGNT (pegar en Jira)

```text
Resultado AGNT

1) Entendido del pedido
- <resumen breve de alcance>

2) Trabajo realizado
- <acciones y/o cambios concretos>

3) Hallazgos y decisiones
- Confirmado: <...>
- Parcial: <...>
- Faltante/Bloqueante: <...>

4) Riesgos
- <riesgo tecnico/negocio o "sin riesgos nuevos">

5) Siguiente paso sugerido
- <accion humana esperada o criterio para cerrar>
```

## Plantilla "Respuesta a Pregunta AGNT" (referencia obligatoria)

Usar cuando en el hilo exista **`Pregunta AGNT:`** (o equivalente claro) aun **sin** respuesta del agente que la cite.

```text
Resultado AGNT

En respuesta a Pregunta AGNT
- Comentario referido: <autor, fecha si consta>
- Cita / resumen de la pregunta: "<frase o bullets tal como se planteo>"

Respuesta
- <respuesta punto 1>
- <respuesta punto 2>

(Si ademas aplica la descripcion del ticket sin conflicto, se puede anadir un bloque "Contexto del ticket" breve.)
```

## Plantilla "Puerta de codigo" (pedido que toca repo)

Usar cuando el ticket pida implementacion o edicion de archivos del proyecto **sin** aprobacion previa en el hilo.

```text
Resultado AGNT — Revision previa a cambios en el repositorio

Este pedido implica cambios en el código o archivos versionados del proyecto Mundial 2026.
Por gobierno del equipo, no aplico cambios en el repo ni cierro diseno de implementacion hasta decision explicita.

Resumen del pedido interpretado:
- <que habria que hacer en el repo, en terminos de alcance>

Archivos o zonas del proyecto probablemente afectadas (indicativo):
- <rutas o modulos>

Riesgos / dudas breves:
- <...>

@Gonzalo Lopolito ¿Aprobamos seguir adelante con este cambio en el repo? (Si si, indicar alcance o ajustes; si no, cerramos o replanteamos el ticket.)
```

## Guardrails

- No publicar PII en comentarios de Jira.
- No asumir reglas fiscales o conciliacion no explicitadas.
- **Cambios en repo** solo despues de **aprobacion explicita** de **@Gonzalo Lopolito** en el hilo (salvo que el ticket ya deje esa aprobacion asentada).
- Con **Pregunta AGNT** en comentarios: **no** ignorar el hilo; responder con comentario nuevo que **referencie** esa pregunta.
- Con **Pregunta al equipo AGNT** pendiente de respuesta humana: **no** aplicar cambios en repo; esperar hilo y refrescar bloque AGNT en descripcion.
- Mantener trazabilidad (`FBL-XX`) en commits/PR cuando haya cambios de repo **post-aprobacion**.
- Si la solicitud es ambigua, responder con preguntas concretas en vez de inventar.

## Sin automatizacion programada en el repo

- **No** hay cron ni scripts en `scripts/` que consulten Jira o disparen al agente solos.
- El disparador es **humano**: pasar el ticket a `Listo para AGNT` y pedir en Cursor (p. ej. «revisar Jira») cuando corresponda.
- Si en el pasado se instaló una entrada en `crontab` que invocaba `jira_agnt_check.py`, **borrarla a mano** (`crontab -e`); ese script ya no existe.

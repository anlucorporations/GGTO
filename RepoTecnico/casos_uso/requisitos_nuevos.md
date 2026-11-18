# Requisitos NUEVOS aprobados en la auditoría del catálogo (2026-11-12)

> Resultado del bloque de preguntas 1–3 al usuario. Estos comportamientos **no existen hoy en
> el código** (verificados por la auditoría adversarial), pero el usuario decidió **mantenerlos
> como requisitos nuevos**. Quedan especificados aquí con identificadores provisionales
> (`RN-…`) y estado **APROBADO — PENDIENTE DE IMPLEMENTACIÓN**. La numeración definitiva
> (D-XX/RN-XX en `requerimientos.md`) se asignará al integrarlos en la Fase 3.

## RN-EV-01 — Evidencias mínimas por tipo de resolución
**Estado:** APROBADO — PENDIENTE DE IMPLEMENTACIÓN (afecta `app/services/resolucion.py`,
`routes_casos.py` cierre, y `app_movil` operaciones)
**Especificación (EARS):**
- Si el cierre del caso es una **resolución final** (IVR/COS/SACAS), entonces el sistema exigirá
  al menos **2 evidencias de POTENCIA** registradas.
- Si el resultado del caso es **DIFERIDO**, entonces el sistema exigirá al menos
  **3 evidencias DEMO** (demostrativas).
- Si el resultado del caso es **ENRUTADO**, entonces el sistema exigirá al menos **1 evidencia**.

**Criterios (Gherkin, aspiracionales hasta implementar):**
```gherkin
Dado un caso con 2 evidencias de POTENCIA
Cuando se cierra con IVR/COS/SACAS
Entonces el cierre se acepta.

Dado un caso con solo 1 evidencia de POTENCIA
Cuando se intenta cerrar
Entonces el sistema rechaza el cierre indicando el faltante (2 requeridas).

Dado un caso con 2 evidencias DEMO
Cuando se intenta marcar DIFERIDO
Entonces el sistema rechaza indicando que faltan 3 demostrativas.
```
**CU afectados:** CU-W-20 · CU-A-15, CU-A-16, CU-A-17 · (APK: bloqueo local antes de encolar).

## RN-NC-01 — NO CONTESTA acumulativo
**Estado:** APROBADO — PENDIENTE DE IMPLEMENTACIÓN. **El comportamiento vigente es D-88**
(CITADO + cita 1ª visita 08:00 del día siguiente + CONTACTO método COS); sobre él se añade:
**Especificación (EARS):**
- Si el caso acumula **N intentos de «No Contesta»** (N configurable por central, valor
  propuesto 3), entonces el sistema devolverá el caso a la cola de despacho (estado canónico)
  y lo excluirá de la agenda de 1ª visita.
**Criterios (Gherkin, aspiracionales):**
```gherkin
Dado un caso con 3 registros de NO CONTESTA (N = 3)
Cuando se registra el tercero
Entonces el caso vuelve a la cola de despacho
Y la cita de 1ra visita se cancela con la actividad correspondiente.
```
**CU afectados:** CU-W-18 · CU-A-12.

## RN-EST-01 — Matriz de transiciones de estado de casos
**Estado:** APROBADO — PENDIENTE DE IMPLEMENTACIÓN. **Hoy** solo existe el camino único de
estado (D-120: delegación de especiales al caso) y el rechazo 409 de estados terminales
(CERRADO/CANCELADO/ENRUTADO); no hay matriz formal.
**Especificación (EARS):**
- El sistema deberá validar toda solicitud de cambio de estado contra una **matriz de
  transiciones** (estado origen × estado destino) configurable por catálogo.
- Si la transición no está en la matriz, entonces el sistema responderá **409** con la lista
  de transiciones válidas desde el estado actual.
**Criterios (Gherkin, aspiracionales):**
```gherkin
Dado un caso en estado PENDIENTE
Cuando se solicita ir a ASIGNADO y la matriz lo permite
Entonces el estado cambia y la bitácora registra la transición.

Dado un caso en un estado que no permite ir a CERRADO directamente
Cuando se solicita ese cambio
Entonces el sistema responde 409 con las transiciones válidas.
```
**CU afectados:** CU-W-16 · CU-AV-03 (R-AV-6) · APK: estados locales coherentes con la matriz.

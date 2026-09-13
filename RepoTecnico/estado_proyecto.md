# Estado del Proyecto — GGTO-v1

- **Proyecto:** Página HTML de gestión de averías — Central Francisco Salias (Área 4)
- **Fase actual:** 1 (Concepto) — en cierre
- **Última actualización:** 2026-02-19
- **Fuente primaria:** `RepoTecnico/PAGINA-GGTO-INICIAL.md`

---

## 1. Resumen ejecutivo

Se analizó el documento de concepto y se produjo una propuesta técnica completa para una página
HTML que gestione los reportes de avería de la central: 7 pestañas funcionales, ingesta diaria de
un CSV, dosificación del despacho por cuadrillas, sectores de averías concentradas, seguimiento
de casos especiales y reportes diario y semanal.

Se realizaron **3 bloques de entrevista** (9 preguntas) con los que se fijaron **11 decisiones**
y se cerraron **7 ambigüedades** del documento fuente. Quedan **7 ambigüedades abiertas**, todas
asociadas a los ciclos C4–C6, más dos pendientes administrativos (repositorios remotos y GCP).

---

## 2. Artefactos generados

| Archivo | Contenido | Estado |
|---|---|---|
| `RepoTecnico/PAGINA-GGTO-INICIAL.md` | Fuente primaria del usuario (concepto y estructuras). | Recibido |
| `RepoTecnico/PROPUESTA-PAGINA-GGTO.md` | Análisis, requerimientos, arquitectura, ciclos, decisiones D-01 a D-11 y ambigüedades A-01 a A-14. | Completado |
| `RepoTecnico/requerimientos.md` | 27 RF, 7 RNF, 7 RT, 8 reglas de negocio, glosario, alcance por ciclo y criterios de Fase 1. | Completado |
| `RepoTecnico/diccionario_datos.md` | Diccionario de `averias.json` (29 campos), `despacho.json`, `estructura.json` y 6 archivos de configuración, con integridad y formatos. | Completado |
| `RepoTecnico/entornos_globales.md` | Rutas, estructura de carpetas, stack, lanzador del servidor local, constantes y notas del host. | Completado |
| `RepoTecnico/estado_proyecto.md` | Este documento. | Vivo |

---

## 3. Decisiones tomadas (D-01 a D-11)

| ID | Decisión | Bloque |
|---|---|---|
| D-01 | Persistencia con servidor local mínimo + File System Access API (lectura y escritura de los JSON). | 1 |
| D-02 | Alcance: MVP primero = CONFIGURACION + CASOS + INGESTA + PANEL (ciclos C1–C3). | 1 |
| D-03 | Sectores = lista de calles/urbanizaciones, con emparejamiento normalizado y cola de asignación manual. | 1 |
| D-04 | La columna `extra` de `averias.json` es dato de Red / planta externa. | 2 |
| D-05 | RN-03: con palabras clave de fibra → `PEND`; sin ellas → `GESTION`. | 2 |
| D-06 | Todo caso ingerido entra `clase = REP`; la corrección a `CNS`/`REF` es manual. | 3 |
| D-07 | Ficha de cuadrilla: `id, nombre, técnicos[], vehículo, turno, sectores[], status`. | 3 |
| D-08 | Los encabezados del CSV diario coinciden con `estructura.json`; ingesta genérica. | 3 |
| D-09 | El maestro de casos se llama `averias.json`. | 4 |
| D-10 | La `informacion` duplicada son dos columnas: `informacion_1` e `informacion_2`. | 4 |
| D-11 | Palabras clave de clasificación editables en CONFIGURACION con búsqueda normalizada. | 4 |

---

## 4. Ambigüedades

**Cerradas (7):** A-01 (D-09), A-02 (D-10), A-03 (D-07), A-06 (D-11), A-07 (D-05),
A-12 (D-08), A-13 (D-06).

**Abiertas (7):**

| ID | Ambigüedad | Ciclo |
|---|---|---|
| A-04 | Numeración y catálogo definitivo de sectores. | C2 |
| A-05 | Definición de «casos citados del día». | C4 |
| A-08 | Formato de salida de los reportes diario y semanal. | C6 |
| A-09 | Definición de «casos especiales». | C6 |
| A-10 | Criterio de desempate de cuadrilla para la construcción. | C4 |
| A-11 | Significado de `P00` (técnicos) y `ups` (averías). | C1 |
| A-14 | `despacho.json` no incluye `sector` ni cuadrilla, necesarios para agrupar. | C4 |

Ninguna de ellas bloquea el arranque del ciclo C1.

---

## 5. Plan de desarrollo acordado

| Ciclo | Entrega | Estado |
|---|---|---|
| C1 | Armazón de pestañas + CONFIGURACION + tabla CASOS + flotante de cierre + persistencia JSON. | No iniciado |
| C2 | INGESTA del CSV diario (filtro, mapeo, dedupe, clasificación, sectores). | No iniciado |
| C3 | PANEL (búsqueda, actualización, alta) + GESTION telefónica. | No iniciado |
| C4 | DESPACHO por sector y cuadrilla + PDF por cuadrilla. | No iniciado |
| C5 | MONITOREO + GRAFICOS. | No iniciado |
| C6 | Reportes diario/semanal + casos especiales y averías concentradas. | No iniciado |
| C7 | Pruebas funcionales con datos reales, impresión y manual de usuario. | No iniciado |

---

## 6. Pendientes para cerrar la Fase 1

- [ ] URLs de los repositorios remotos (GitLab / GitHub) y rama de trabajo.
- [ ] Definición sobre GCP o entorno de preview (o su descarte explícito).
- [ ] Respuestas al bloque 4 de preguntas (A-04, A-05, A-08, A-09, A-10, A-11, A-14) o su
      diferimiento explícito a los ciclos C4–C6.

---

## 7. Próximos pasos

1. **Cerrar Fase 1** con los pendientes del §6.
2. **Fase 2 (Auditoría):** desplegar el equipo de auditoría sobre `requerimientos.md`,
   `diccionario_datos.md` y `entornos_globales.md`; elaborar los casos de uso con criterios
   Gherkin/EARS y trazabilidad a los RF; generar los diagramas (Mermaid/SVG); redactar y auditar
   el documento técnico.
3. **Fase 3 (Desarrollo):** iniciar el ciclo C1 (armazón + CONFIGURACION + CASOS).

---

## 8. Riesgos vigentes

| Riesgo | Impacto | Mitigación prevista |
|---|---|---|
| El CSV diario cambia de columnas sin aviso. | Rompe la ingesta. | La ingesta valida los encabezados contra `estructura.json` y avisa antes de insertar. |
| Direcciones que no coinciden con ningún sector. | Casos sin agrupar. | Cola de asignación manual (RN-04, D-03). |
| El operador abre `index.html` con doble clic (`file://`). | No se pueden leer ni escribir los JSON. | El lanzador abre siempre `http://localhost:8787` y la página avisa si detecta `file://`. |
| Pérdida de datos por edición concurrente o cierre accidental. | Casos perdidos. | Escritura inmediata en cada cambio (RN-07) y exportación de respaldo del JSON. |
| Typos en los textos del CSV. | Clasificación incorrecta. | Búsqueda normalizada y lista de claves editable (D-11). |
| Fallo de escritura por trabajar sobre Google Drive (`G:`). | No se guardan los documentos. | Escribir en `%TEMP%` y copiar al destino (ver `entornos_globales.md` §9). |

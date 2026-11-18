# Catálogo de Casos de Uso — GGTO v2 (Web + APK + Asistente)

> Generado el 2026-11-11 (Fase 2 del skill, orden del usuario: «analiza el proyecto completamente
> y genera todos los casos de usos posibles tanto para la web como para la APK»).
> Fuente: `requerimientos.md` (actores/RF/RNF/RT), inventario de los 17 routers de `app/api`
> y de la APK `app_movil` (Flutter `ggto_tecnico` 1.15.22+47), y canon del asistente C1–C6.

## Archivos del catálogo

| Archivo | Alcance | CUs |
|---|---|---|
| [`casos_uso_web.md`](casos_uso_web.md) | Aplicación web (API `app/` + panel), actores ACT-01, ACT-03*, ACT-04, ACT-05, ACT-06, ACT-07 | CU-W-01…CU-W-63 |
| [`casos_uso_apk.md`](casos_uso_apk.md) | APK de campo `app_movil` (ACT-02 TÉCNICO, CU-A-01…22) + modo GESTIÓN del COORDINADOR (ACT-07, CU-A-23…28) | CU-A-01…CU-A-28 |
| [`casos_uso_asistente.md`](casos_uso_asistente.md) | Asistente virtual de gestión por texto libre (ciclos C1–C6, `asistente-ggto`) | CU-AV-01…CU-AV-10 |
| [`requisitos_nuevos.md`](requisitos_nuevos.md) | Requisitos nuevos aprobados en la auditoría (RN-EV-01, RN-NC-01, RN-EST-01) — pendientes de implementación | — |
| [`diagramas_catalogo.md`](diagramas_catalogo.md) | **Gráficos (`/graficos`)**: 9 diagramas de casos de uso (actores↔CU, include/extend) + 6 de secuencia, en **Mermaid** | 15 diagramas |
| `svg/` | Los mismos 15 diagramas rasterizados a **SVG** (`d01.svg`…`d15.svg`) con mermaid-cli 12.2.0 | 15 SVG |

\* ACT-03 no tiene portal propio (D-156): su objetivo se materializa a través del Supervisor
y del outbox (ver CU-W-32/CU-W-33) y por los canales Telegram/WEB-MCP.

## Actores

| ID | Actor | Rol(es) en el sistema | Canal principal |
|---|---|---|---|
| ACT-01 | Supervisor de la central | `SUPERVISOR` (con `ADMIN` como variante de gestión) | Web PC |
| ACT-02 | Técnico de campo | `TECNICO` | APK Android |
| ACT-03 | Personal externo solicitante | sin cuenta (canalTelegram/WEB-MCP/aviso interno) | D-156 |
| ACT-04 | Administrador del sistema | `ADMIN` / `SUPER` | Web PC |
| ACT-05 | Sistema (automático) | procesos backend, cron, outbox | Backend |
| ACT-06 | Integración IA (WEB-MCP) | `/api/v1/mcp` | MCP |
| ACT-07 | Coordinador | `COORDINADOR` (cuenta de gestión separada, DEC-G16) | Web / APK gestión |

## Notación y convenciones

- **Criterios de aceptación funcionales** en **Gherkin** (`Dado / Cuando / Entonces / Y / Pero`),
  uno por comportamiento verificable, con números concretos y comprobables por tests
  (contrato API, BD, UI o APK).
- **Restricciones del sistema** (reglas permanentes, estados, fail-closed) en **notación EARS**:
  `Cuando <evento>, el sistema <respuesta>` · `Si <condición>, entonces el sistema <respuesta>` ·
  `Mientras <estado>, el sistema <respuesta>` · `El sistema deberá <capacidad>`.
- **Trazabilidad**: cada CU enlaza los identificadores reales del proyecto —
  RF-01…RF-38, RNF-01…RNF-25, RT-01…RT-14 (de `requerimientos.md`), decisiones D-XX,
  reglas RN-AL/H-XX/DEC-G y RT-APK citadas en el código de `app/` y `app_movil/`.
  **Nota (auditoría):** el código y el diccionario de datos anclan además otros rangos RF;
  **decisión del usuario (bloque 2):** mantener RF-01…38 como base del catálogo y resolver el
  resto con esta **tabla de equivalencias** (la numeración RF es por-documento de incremento):

| Requisito | Documento de origen | Equivalencia en este catálogo |
|---|---|---|
| RF-39…RF-44 | `incremento_D81_*` (sync/mensajería/panel) | CU-W-49/50 (mensajería), CU-W-33 (alta de especiales = RF-44 en D-81) |
| RF-45…RF-56 | `incremento_D89_*` (identificador de pago, reclasificación) | CU-W-12/14/15 (ciclo del caso, D-89/D-90) |
| RF-59…RF-68 | `incremento_D99_*` (jornada/corte: RF-65 corte, RF-68 reproceso) | CU-W-28/60 (cierre de jornada), CU-A-28 (ZIP de jornada) |
| RF-73 | `credencial_local.dart` (credencial en dispositivo) | CU-A-02 (PIN/credencial local) |
| RF-APK-06/07/08/12 | citados en código de la APK | CU-A-05 (descarga), CU-A-12 (NO CONTESTA = RF-APK-12) |
| RF-APK-13…30 | `incremento_D95_apk_gestion.md` (APK gestión) | CU-A-23…28 (modo GESTIÓN del COORDINADOR) |
| RF-44 (disclaimer) | `propuesta_mejora_apk_v1.md` — **colisión de numeración** con RF-44 de D-81 | CU-A-01 (aviso legal; **decisión del usuario, bloque 3: aceptación en cada login**) |
- **Regla de testeabilidad**: ningún criterio sin posibilidad de test. Los criterios se formulan
  sobre resultados observables (código de estado HTTP, fila en BD, texto en UI, evento outbox).

## Modelo de roles (guardas del backend, `app/api/deps.py`)

| Guarda | Roles | Uso |
|---|---|---|
| `_escritura` | ADMIN + SUPERVISOR | escritura en casos, despachos, masivas, config, ingesta, especiales, mensajes |
| `_lectura` (casos) | TECNICO + ADMIN + SUPERVISOR | búsqueda/ficha de casos (**COORDINADOR excluido**, DEC-G20) |
| `_gestion` | ADMIN + SUPERVISOR + TECNICO | cierre/cita/enrutado/contacto (D-112) |
| `_material` / `_especial_alta` | ADMIN + SUPERVISOR + COORDINADOR | material y alta de casos especiales |
| `_envio_supervisor` | COORDINADOR | mensajes al Supervisor con destino forzado (DEC-G9/G15; **no** aplica a despachos) |
| `_falla_escritura` | ADMIN + SUPERVISOR | escritura de fallas masivas |
| `require_roles()` (sin argumentos) | solo SUPER (bypass ROL_SUPER) | auditoría, sistemas, remitentes del asistente |
| mantenimiento | `X-Mantenimiento-Token` (fail-closed 503) | purga y tareas off-schema |

Alcance por central: RLS acotado a `usuario.id_central`; SUPER ve todas (D-95, RNF-21).

## Numeración

- `CU-W-nn` web · `CU-A-nn` APK · `CU-AV-nn` asistente. Los CU «ACT-05» marcan objetivos
  del sistema (procesos automáticos) y se auditables igual que los humanos.

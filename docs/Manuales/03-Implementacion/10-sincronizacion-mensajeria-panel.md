# 10 — Sincronización, mensajería interna y panel de gestión diaria (Incremento D-81)

> Este manual explica tres mejoras nuevas del sistema: cómo se registra cada sincronización de la app móvil, cómo los supervisores envían mensajes a los técnicos, y cómo se ve el resumen diario de trabajo en el panel principal.

---

## 1. ¿Qué es el log de sincronización?

Cada vez que un técnico usa la app móvil para **descargar** sus casos del día o para **subir** (cargar) los resultados de su trabajo, el sistema guarda un **registro** con:

- Quién sincronizó (P00 del técnico).
- Qué cuadrilla tenía asignada.
- Qué dispositivo usó.
- Cuándo empezó y cuándo terminó.
- Cuántos casos recibió, procesó o fallaron.
- Si la sincronización fue **OK**, **parcial** o con **error**.

Además, se guarda un **checklist paso a paso**:
1. ¿Hubo conexión con el servidor?
2. ¿El login fue correcto?
3. ¿La descarga funcionó?
4. ¿La carga funcionó?

Cada paso queda marcado como OK, error u omitido (si un paso anterior falló).

### ¿Quién puede verlo?

- **Supervisor, Administrador y Super Usuario** pueden abrir **Sistemas → Sincronización** en la web para consultar el historial.
- El técnico ve el resultado del último checklist en la pantalla **Dispositivo** de la app.

---

## 2. ¿Qué es la mensajería interna?

Es un **chat corto de solo ida**: el supervisor envía mensajes y los técnicos los reciben. Los técnicos **no pueden responder**.

### ¿Qué mensajes se envían?

1. **Texto libre** escrito por el supervisor (máximo 500 caracteres).
2. **Recordatorios automáticos** de citas del día (una hora antes).
3. **Resumen automático** después de cada sincronización del técnico.
4. **Alarmas automáticas** cuando hay una falla masiva en el sector de su despacho.

### ¿Cómo llegan los mensajes?

- La app del técnico **revisa cada 20 segundos** si hay mensajes nuevos.
- El técnico puede marcarlos como leídos.
- Los mensajes se guardan durante **5 días**; los que no se leyeron se conservan hasta que el técnico los abra (con un tope máximo de 30 días).

### ¿Quién puede enviar?

- **Supervisor, Administrador y Super Usuario** pueden escribir mensajes.
- Pueden enviarlos a **todos los técnicos**, a una **cuadrilla** entera o a un **técnico** específico.

---

## 3. ¿Qué es el panel de gestión diaria?

Es la **pantalla principal** que ve el supervisor al entrar al sistema. Muestra, para cada cuadrilla:

- **Asignadas**: cuántos casos tiene esa cuadrilla en el despacho de hoy.
- **Cerradas**: de esos, cuántos ya están resueltos (estado Cerrado).
- El porcentaje de avance.

Se pueden ver dos modos:
- **Común**: solo los casos residenciales normales.
- **Referidos**: solo los casos especiales clasificados como referidos.

La pantalla se **actualiza sola cada 30 segundos** mientras esté visible. Si cambias a otra pestaña del navegador, se pausa para no gastar recursos.

### Alta rápida de casos especiales

Desde el mismo panel, el supervisor puede pulsar **«Agregar caso especial»** para crear un nuevo caso (empresa, gobierno o referido) sin salir de la pantalla.

---

## 4. Parámetros que el supervisor puede ajustar

En **Configuración** se pueden cambiar estos valores:

| Parámetro | Valor por defecto | Para qué sirve |
|---|---|---|
| Segundos de sondeo de mensajes | 20 | Cada cuánto la app pregunta si hay mensajes nuevos. |
| Segundos de auto-refresco del panel | 30 | Cada cuánto se actualiza la pantalla de gestión diaria. |
| Días de retención de mensajes | 5 | Cuánto duran los mensajes leídos. |
| Días máximos de retención (no leídos) | 30 | Tope de seguridad para mensajes sin leer. |
| Días de retención del log de sincronización | 90 | Cuánto se conserva el historial de descargas/cargas. |
| Minutos de antelación del recordatorio de cita | 60 | Con cuánta anticipación avisa una cita. |
| Minutos de timeout de sesión de sync | 10 | Si una sincronización se queda colgada, después de cuántos minutos se cierra sola. |

---

## 5. Resumen rápido

| Función | ¿Dónde se ve? | ¿Quién lo usa? |
|---|---|---|
| Log de sincronizaciones | Web: Sistemas → Sincronización / App: Dispositivo | Supervisor, Admin, Super Usuario (web); técnico (app) |
| Checklist de sync | App: pantalla Dispositivo | Técnico |
| Enviar mensaje | Web: Menú de usuario → Mensajes | Supervisor, Admin, Super Usuario |
| Recibir mensajes | Web: Menú de usuario → Mensajes / App: pantalla Mensajes | Técnico |
| Panel gestión diaria | Web: pantalla principal (OPERACIÓN) | Supervisor, Admin, Super Usuario |
| Alta de caso especial | Web: botón en el panel | Supervisor, Admin, Super Usuario |

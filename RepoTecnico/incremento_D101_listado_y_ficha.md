# Incremento D-101 — Listado, cabecera de la ficha y acciones con iconos

| Campo | Valor |
|---|---|
| Documento | `incremento_D101_listado_y_ficha.md` |
| Estado | v1.0 |
| Fecha | 2026-10-15 |
| Origen | Petición directa del usuario (tres puntos sobre la APK) |
| Decisiones | DEC-LF-1 … DEC-LF-4 |
| Numeración | Continúa la del proyecto: **RF-76…RF-78** · **RNF-38** · **RT-26** (el máximo en uso era RF-75 / RNF-37 / RT-25) |

---

## 1. Problema y objetivo

Tres defectos de uso detectados en campo sobre la APK:

1. El **listado principal** mezclaba el trabajo pendiente con lo ya gestionado:
   el técnico volvía a ver los casos que acababa de cerrar, enrutar, diferir o
   citar, y tenía que buscarse los que le quedaban.
2. La **cabecera de la ficha** rotulaba el identificador de pago
   (`Identificador de pago (70*): …`) y mostraba como contacto el campo
   `contacto_cliente`, que en muchos reportes llega **vacío** mientras el número
   real viene dentro del texto libre de «Información».
3. El **pie de la ficha** apilaba hasta cuatro botones de ancho completo y el
   estado se mostraba como chip de texto: entre ambos se comía la pantalla que
   el técnico necesita para leer el caso.

---

## 2. Alcance

### Dentro
1. Ocultar del listado principal los casos **ya gestionados**, con un
   **conmutador** para volver a verlos.
2. Cabecera de la ficha **sin el rótulo** del identificador de pago, y contacto
   tomado del texto de **Información** cuando el caso no trae uno propio.
3. El **estado como icono** en el listado y las **acciones del pie como iconos**
   con etiqueta, en lugar de botones.

### Fuera
- Cambiar qué estados son terminales para el servidor (siguen siendo CERRADO,
  CANCELADO y ENRUTADO): esto solo afecta a lo que **muestra la APK**.
- Sincronizar el conmutador entre dispositivos.

---

## 3. Nuevos Requerimientos Funcionales (RF-76…RF-78)

| # | Enunciado | Prioridad |
|---|---|---|
| **RF-76** | **Ocultar del listado principal** los casos cuyo estado sea CERRADO, ENRUTADO, DIFERIDO, CITADO o CANCELADO —«No contesta» incluido, porque esa acción deja el caso en CITADO— y ofrecer un **conmutador** para volver a verlos. | Alta |
| **RF-77** | En la cabecera de la ficha, mostrar el **identificador de pago sin rótulo** y usar como **Contacto** el teléfono que aparezca en el texto de **Información** cuando el caso no traiga número de contacto propio. | Alta |
| **RF-78** | Mostrar el **estado del caso como icono** en el listado y las **acciones del pie de la ficha como iconos** con etiqueta, en lugar de chips y botones. | Media |

**Totales del incremento:** **3 RF** (RF-76…RF-78) · **1 RNF** (RNF-38) · **1 RT** (RT-26).

---

## 4. Nuevo Requerimiento No Funcional (RNF-38)

| # | Enunciado | Criterio de verificación |
|---|---|---|
| **RNF-38** | El estado de un caso no puede quedar solo en el icono: el nombre tiene que seguir disponible para quien no distinga el símbolo o use un lector de pantalla. | `EstadoIcono` envuelve el icono en `Tooltip` y en `Semantics` con el nombre del estado; hay una prueba que comprueba que `find.byTooltip('CERRADO')` lo encuentra. |

---

## 5. Requerimiento Técnico (RT-26)

| # | Enunciado |
|---|---|
| **RT-26** | El filtro del listado y la lectura del teléfono son **funciones puras** en `acciones_caso.dart` (`estaGestionado`, `casosVisiblesDe`, `telefonoEnTexto`, `contactoParaMostrar`), separadas del proveedor y de la base de datos, para poder probarlas sin el canal de plataforma de SQLite. |

---

## 6. Decisiones (DEC-LF-1 … DEC-LF-4)

| # | Decisión | Motivo |
|---|---|---|
| **DEC-LF-1** | Los casos gestionados se **ocultan** pero hay un **conmutador** («Ver gestionados (N)») para mostrarlos. | Elección del usuario. Deja el listado limpio para trabajar sin quitarle al técnico la posibilidad de reverificar un cierre, cosa que en campo hace falta. |
| **DEC-LF-2** | El rótulo del identificador de pago se quita **solo de la cabecera**; la sección «Contacto» del cuerpo lo conserva. | Elección del usuario. La cabecera gana espacio y el dato sigue rotulado donde hay sitio para leerlo con contexto. Si el caso no trae identificador, la fila **no se pinta**: antes quedaba un «Sin identificador de pago (70*)» permanente. |
| **DEC-LF-3** | El teléfono de «Información» se usa **solo si el caso no trae contacto propio**. | Elección del usuario. El contacto propio es el dato curado y editable desde la ficha; el de Información es texto de ingesta y sirve de respaldo, no de sustituto. |
| **DEC-LF-4** | El respaldo se aplica **solo en la cabecera de la ficha**, no en la tarjeta del listado. | La tarjeta ya tiene una prueba explícita de que **no inventa** un teléfono cuando el contacto viene vacío; llevar ahí el respaldo la contradiría. Queda como decisión reversible si el usuario prefiere unificar. |

---

## 7. Cómo se resuelve el teléfono

`telefonoEnTexto` reconoce las formas venezolanas habituales del archivo de
ingesta —`04121234567`, `0412-1234567`, `+58 412 1234567`, `(0212) 555.1234`— y
normaliza siempre a los **11 dígitos con el `0` inicial**, que es como se marca
desde el móvil.

Deliberadamente **no** reconoce un identificador de pago `70*`: sus 10 dígitos no
encajan con el patrón (código de área `4xx`/`2xx`), así que un `7014000848` no se
confunde con un teléfono. Hay pruebas para ambas cosas.

---

## 8. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R-101-1 | Ocultar los gestionados puede hacer que el técnico **pierda de vista** un caso que creía pendiente. | El conmutador dice cuántos hay («Ver gestionados (N)»), la franja inferior avisa de los ocultos y, si **todos** los del dispositivo están gestionados, la pantalla lo dice y ofrece mostrarlos. |
| R-101-2 | El respaldo desde «Información» podría mostrar un número equivocado (otro teléfono dentro del texto). | Solo entra cuando no hay contacto propio y se toma el **primero** que encaja con el patrón; el dato sigue siendo editable desde la ficha, que es el camino curado. |
| R-101-3 | Sustituir botones por iconos puede volver las acciones menos evidentes. | Cada icono conserva su **etiqueta de texto** debajo y el alto táctil mínimo de la guía (RNF-23); el estado lleva `Tooltip` y `Semantics`. |

---

## 9. Verificación

| Ámbito | Evidencia |
|---|---|
| Reglas | `estaGestionado` para los cinco estados gestionados y los cuatro de trabajo; `casosVisiblesDe` con y sin conmutador. |
| Teléfono | Las cuatro formas venezolanas, la normalización a 11 dígitos, el **rechazo del `70*`**, el texto sin número, y la precedencia del contacto propio. |
| Iconos | `EstadoIcono.aspecto` por estado, la tarjeta usa `EstadoIcono` y **no** `EstadoChip`, el tooltip conserva el nombre, y el pie pinta `FichaAccion` sin ningún `ElevatedButton`. |
| Cabecera | Sin rótulo, con `Contacto: …`, y sin fila cuando no hay identificador. |
| Suite | `flutter analyze` → **«No issues found!»**; `flutter test` → **133/133** (114 previos + **19 nuevos** de `app_movil/test/d101_listado_y_ficha_test.dart`). |
| Regresión | Se actualizaron las aserciones que comprobaban los rótulos y los botones anteriores en `d87_ficha_test.dart` (2 pruebas) y `d93_identificador_pago_test.dart` (2 pruebas). |

# 11 — La app del técnico: lo que cambió (Incremento D-82)

> Este manual explica, en lenguaje sencillo, cinco mejoras de la **app del técnico**
> (la APK «GGTO Técnico»): que siempre muestre lo que tiene guardado en el teléfono,
> que muestre una barra con el avance de la sincronización, que tenga un **menú de
> usuario** con la sección **Usuario**, y que el **reporte de falla masiva** pida la
> ODN, la dirección, la FAT y la descripción, con **hasta 2 fotos**.

---

## La app ya muestra lo que tiene guardado en el teléfono

El técnico trabaja muchas veces sin señal. Por eso la app **guarda en el teléfono**
todos los casos que descarga.

Antes había un problema: la app descargaba los casos y los guardaba, pero la
pantalla seguía diciendo *«No tiene casos asignados»*. Ya está corregido:

- Al abrir la app, la lista muestra **primero lo que hay guardado** en el teléfono
  (aparece al instante, aunque no haya señal).
- Después, si hay internet, se **actualiza sola** con lo último del servidor.
- Arriba de la lista hay una franja que dice: **«Contenido local · N casos ·
  actualizado el …»**.
- Si no hay conexión, la franja se pone **amarilla** y ofrece el botón
  **Reintentar**.
- Los **datos del usuario** (nombre, correo y cuadrilla) también se guardan en el
  teléfono: la sección Usuario abre aunque no haya señal.

> En resumen: lo que se ve en pantalla es siempre lo que el teléfono tiene guardado;
> internet solo lo pone al día.

---

## Una barra que muestra el avance de la sincronización

Debajo del título de la pantalla hay una **barra de progreso** con un texto:

| Lo que se ve | Qué significa |
|---|---|
| Barra **verde** «Datos sincronizados» | Todo el trabajo del día ya se envió. |
| Barra **amarilla** «N acciones pendientes de envío» | Hay trabajo guardado esperando internet. |
| Barra **roja** «N acciones con error» | Algo no se pudo enviar; hay que revisarlo en **Dispositivo**. |
| Barra avanzando con «42 % · Enviando acciones… (21 de 50)» | Se está sincronizando ahora mismo. |

Durante una sincronización la barra avanza de verdad:

- **Descarga**: conectando → descargando los casos → guardando en el teléfono.
- **Carga**: subiendo fotos (una por una) → enviando las actividades → cerrando la
  jornada.

La misma barra aparece en **Casos**, **Alertas**, **Mensajes** y **Dispositivo**
(en Dispositivo se ve más grande, con el porcentaje).

---

## El menú de usuario (icono de persona)

En la esquina superior derecha, en todas las pantallas, hay un **icono de persona**.
Al tocarlo se abre la sección **Usuario**, que reúne el perfil y la cuenta. El botón
de **cerrar sesión** también está ahí dentro.

---

## Qué se puede hacer en la sección Usuario

### Datos personales

- Se ven el **nombre**, el **apellido**, el **P00** y el **correo**.
- El correo se puede **corregir** y guardar con el botón «Guardar correo».

### Datos administrativos

- **P00**, **rol**, **cuadrilla** (código y nombre), desde cuándo está en esa
  cuadrilla, la **central**, el **identificador del teléfono** y la **versión de la
  app** que tiene instalada.

### Cambiar la contraseña

1. Escriba su **contraseña actual**.
2. Escriba la **nueva** (mínimo 8 caracteres).
3. Repítala para confirmar.
4. Pulse **«Cambiar contraseña»**.

Si la contraseña actual no es la correcta, el sistema lo avisa y no cambia nada.

### Ver las palabras de seguridad

Las 12 palabras de seguridad **no se guardan escritas** en el servidor (solo una
marca que no se puede leer). Por eso, para **verlas** hay que **generarlas de
nuevo**:

1. Escriba su **contraseña actual** (es obligatorio: así nadie más puede verlas).
2. Pulse **«Ver palabras de seguridad»**.
3. La app muestra las **12 palabras numeradas**, y se pueden **copiar** con un botón.

> **Importante:** las palabras anteriores **dejan de funcionar** en cuanto se
> generan las nuevas. Guárdelas en un lugar seguro. El sistema deja registrado
> (auditoría) que usted las regeneró, pero **no** guarda las palabras.

---

## Reportar una falla masiva

En la pantalla **Alertas** está el formulario de **Falla masiva**. Ahora pide
exactamente estos datos:

| Campo | ¿Obligatorio? | Ejemplo |
|---|---|---|
| **ODN** | Sí | `ODN-2324X-0451` |
| **Dirección** | Sí | `Calle 4 con Av. Principal, casa 12` |
| **FAT** | Sí | `FAT-04` |
| **Descripción** | Sí | `6 clientes sin servicio en la FAT 4 del sector Norte 2` |
| Sector | No | `12` |
| **Fotos de evidencia** | No, **máximo 2** | foto de la FAT, foto del equipo |

Cómo se usan las fotos:

- Pulse **«Añadir foto de evidencia»**: se abre la **cámara** y la foto queda
  guardada con su ubicación y su hora.
- Se ve una **miniatura** de cada foto, con una **X** para quitarla si salió mal.
- El contador indica **«1 de 2»**; al llegar a 2, el botón se desactiva.

Al pulsar **«Reportar falla masiva»**:

1. La app **revisa los datos** (si falta algo, avisa y no envía nada).
2. **Sube las fotos** (si hay internet).
3. **Registra la falla** para que el supervisor la vea en la web.

### ¿Y si no hay señal?

No se pierde nada: el reporte y sus fotos **quedan guardados** en el teléfono. La
app lo avisa con un mensaje naranja. Cuando haya internet (o al pulsar **Cargar**
en la pantalla Dispositivo), se suben las fotos y se envía el reporte.

---

## Resumen rápido

| Función | ¿Dónde está? | ¿Quién la usa? |
|---|---|---|
| Ver los casos guardados | App: pantalla **Mis casos** (franja «Contenido local») | Técnico |
| Ver el avance de la sincronización | App: barra bajo el título (todas las pantallas) | Técnico |
| Abrir el perfil y la cuenta | App: **icono de persona** (arriba a la derecha) | Técnico |
| Cambiar la contraseña | App: Usuario → **Cambiar la contraseña** | Técnico |
| Ver las 12 palabras | App: Usuario → **Palabras de seguridad** (pide la contraseña) | Técnico |
| Reportar falla masiva | App: **Alertas** → Falla masiva | Técnico |
| Ver la falla reportada | Web: **Alertas** → ficha de la falla (ODN, FAT, dirección, fotos) | Supervisor, Admin, Super Usuario |

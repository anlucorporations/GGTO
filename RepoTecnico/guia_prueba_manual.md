# Guía de prueba manual — Ciclo C1 (GGTO-v1)

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías de la central Francisco Salias (Área 4).
- **Ubicación:** `C:\GGTO\proyecto`
- **Alcance de esta guía:** verificar a mano lo que las pruebas automatizadas no pueden cubrir (el selector
  de carpeta y el guardado real desde el navegador). Cubre el ciclo **C1**; los ciclos C2 a C7
  (ingesta, PANEL/GESTION, despacho y PDF, monitoreo, reportes) todavía no están implementados.

---

## 1. Antes de empezar

| Requisito | Comprobación |
|---|---|
| Navegador Edge o Chrome actualizado | La página usa la File System Access API; Firefox no la soporta (solo permitiría el modo descarga). |
| Python 3.7 o superior | `python --version`. Es lo que levanta el servidor local. |
| La carpeta de datos existe | `C:\GGTO\datos` con sus 10 archivos. Si falta, la propia página ofrece crearla. |

> **Importante:** no abras `index.html` con doble clic. En `file://` el navegador bloquea la lectura
> de los archivos de datos. Usa siempre `http://localhost:8787`.

---

## 2. Levantar la página

```powershell
cd C:\GGTO\proyecto
pwsh -File .\servir-ggto.ps1
```

Se abre el navegador en `http://localhost:8787/index.html`. El servidor escucha **solo en loopback**
y sirve **solo** el subdirectorio `app/`; si además quieres comprobarlo, abre
`http://localhost:8787/datos/averias.json` y debe responder **404** (los datos no se exponen por HTTP).

---

## 3. Lista de comprobación

### 3.1 Acceso (CU-01)

- [ ] Al abrir, se ve **solo el diálogo de acceso**: no aparecen casos, ni conteos, ni gráficos.
- [ ] Con `tecnicos.json` vacío aparece el paso **«Crear el primer supervisor»** (D-62).
- [ ] Se crea el supervisor con `P00`, nombre y contraseña de **8 caracteres o más**.
- [ ] Con contraseña de 7 caracteres o menos el sistema la rechaza.
- [ ] Con contraseña incorrecta el mensaje es **genérico** (no dice cuál dato falló) y el intento queda
      anotado en `C:\GGTO\datos\incidencias.log`.
- [ ] Tras entrar, el encabezado muestra quién es el operador y su rol; a las **8 horas** (D-45) la
      sesión pide reingresar.

### 3.2 Autorización de la carpeta de datos

- [ ] La página pide permiso para la carpeta **`C:\GGTO\datos`** (gesto obligatorio del usuario).
- [ ] Si se deniega, la página lo explica y no muestra datos.
- [ ] Si se autoriza, los padrones y la configuración se cargan sin errores en la consola (F12).

### 3.3 Configuración (CU-02 a CU-07)

- [ ] `CENTRAL` muestra los datos reales de la central (region CAPITAL, area AREA 4, central 2324X,
      nombre FRANCISCO SALIAS…).
- [ ] En `TECNICOS` se puede dar de alta un operador con `rol = Operador` y comprobar que **no** puede
      editar padrones al iniciar sesión con él (D-35, D-61).
- [ ] En `SECTORES` se puede crear un sector con `id`, `nombre` y varias vías.
- [ ] Al guardar cualquier cambio aparece un archivo `*_AAAA-MM-DD_HHMM.bak` en `C:\GGTO\datos`
      (respaldo previo, D-42); al décimo se descarta el más antiguo.
- [ ] Si se edita el mismo archivo desde otra ventana, el segundo guardado muestra el aviso de
      **conflicto** con quién y cuándo lo modificó, y obliga a elegir entre **Recargar** y
      **Sobrescribir** (D-41).

### 3.4 Casos, cierre y auditoría (CU-10 a CU-15)

> Estos pasos necesitan casos en el maestro: llegan con el **ciclo C2 (ingesta del CSV)**. Hasta
> entonces la tabla aparece vacía, que es el comportamiento esperado.

- [ ] La tabla muestra las **7 columnas** resumidas: nivel, clase, sector, id_averia, nombre, dirección
      y plan.
- [ ] Los filtros y agrupaciones funcionan por abierto/cerrado, cuadrilla, tipo (clase + nivel), clase,
      nivel y estatus.
- [ ] Al seleccionar un caso se abre el flotante con la información agrupada por secciones.
- [ ] **CERRAR CASO** queda **bloqueado** si falta la resolución o la fecha de resolución (D-20).
- [ ] Al cerrar, `historial.jsonl` recibe una línea con fecha y hora, operador, caso, campo, valor
      anterior y valor nuevo (D-56), y la vista de auditoría del caso la muestra.
- [ ] Un operador **no** puede ver ni cerrar casos de otra cuadrilla (D-35).

### 3.5 Diagnóstico y respaldo (CU-21, CU-22)

- [ ] Al cerrar la jornada, la página ofrece crear la copia fechada en `C:\GGTO\respaldo\` (D-49).
- [ ] El diagnóstico reporta: navegador, soporte de la API de archivos, carpeta autorizada y número de
      casos leídos.

---

## 4. Dónde mirar si algo falla

| Síntoma | Qué revisar |
|---|---|
| «Identifíquese para editar» y nada visible | Es lo correcto sin sesión (D-50). Inicia sesión. |
| No aparecen datos tras entrar | Que hayas autorizado `C:\GGTO\datos` y que los archivos existan. |
| Aviso de conflicto al guardar | Otra ventana modificó el archivo: elige Recargar o Sobrescribir. |
| La página no carga | Que `servir-ggto.ps1` siga corriendo y que la URL sea `http://localhost:8787/index.html`. |
| Errores en pantalla | Consola del navegador (F12) y `C:\GGTO\datos\incidencias.log`. |

---

## 5. Qué queda fuera de esta prueba

- La **ingesta del CSV** y la cola de sectores (ciclo C2).
- El **PANEL** de búsqueda/actualización y el **alta manual** de casos, y la bandeja **GESTION** (C3).
- El **despacho** con su PDF por cuadrilla (C4), el **monitoreo y los gráficos** (C5) y los
  **reportes** (C6).
- Las pruebas con datos reales de una semana, la impresión y la restauración probada (C7).

---

## 6. Pruebas automatizadas (complemento)

```powershell
cd C:\GGTO\proyecto
node --test pruebas/pruebas_c1.mjs pruebas/pruebas_almacen_c1.mjs pruebas/pruebas_c1b.mjs
```

Deben pasar **24 de 24**. Cubren la lógica pura y el protocolo de escritura verificada con la API
simulada (lo que el navegador no permite automatizar sin un gesto humano).

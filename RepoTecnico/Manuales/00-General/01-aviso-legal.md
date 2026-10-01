# Aviso legal del proyecto

Documento normativo aplicable al producto **GGTO v0.9.0** (interfaz web y paquete `.apk`). Su texto
de referencia es `disclaimer.md` en la raíz del repositorio; las copias de `docs/Manuales/00-General/`
y de la interfaz se generan a partir de él y deben mantenerse sincronizadas.

## Alcance y punto de verdad

| Artefacto | Ubicación | Papel |
|---|---|---|
| Texto normativo | `disclaimer.md` | Fuente única de verdad |
| Manual literal | `docs/Manuales/00-General/01-aviso-legal.md` | Versión legible e imprimible |
| Manual técnico | este archivo | Regla de ingeniería y trazabilidad |
| Muro de aceptación | `app/web/src/components/AvisoLegal.tsx` | Aceptación obligatoria previa al login |
| Contenido y enlaces | `app/web/src/disclaimer.ts` | Cláusulas, enlaces y clave de almacenamiento |

## Regla de despliegue (EARS)

- **Cuando** un usuario abra la ruta `/login`, **el sistema deberá** mostrar el aviso legal y ocultar
  el formulario de acceso hasta que la casilla de aceptación esté marcada.
- **Mientras** el aviso no haya sido aceptado en el dispositivo, **el sistema no deberá** renderizar
  los controles de inicio de sesión, desbloqueo ni primer acceso.
- **Si** el almacenamiento local no está disponible, **el sistema deberá** volver a solicitar la
  aceptación en cada carga (sin bloquear el acceso por ese motivo).
- **El sistema deberá** exponer tres enlaces desde el muro: aviso completo (HTML), PDF y Ayuda.

## Trazabilidad

| Requisito | Cobertura |
|---|---|
| RNF de gobernanza y trazabilidad de accesos | Registro de aceptación en el dispositivo (`localStorage`) |
| RF de control de acceso (RBAC) | El muro precede a la autenticación; no sustituye ni amplía permisos |
| Protección de datos personales | Secciones 4 y 6 del aviso |

La aceptación registrada en el navegador es una **constancia de lectura**, no una credencial: los
permisos siguen definiéndose exclusivamente por el rol del usuario en la base de datos.

## Verificación

- Prueba unitaria de interfaz: el formulario de acceso permanece oculto hasta aceptar.
- Prueba E2E: `/login` muestra el muro, los enlaces resuelven y tras aceptar aparece el formulario.
- Comprobación documental: `sincronizar_manual.sh` valida que no existan referencias rotas.

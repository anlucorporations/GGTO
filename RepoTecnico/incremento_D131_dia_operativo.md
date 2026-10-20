# Incremento D-131 — La lógica de negocio usa el día operativo (H-14)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-14** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **toda la lógica de negocio** |
| Fecha | 2026-10-20 |
| Alcance | Backend · despliegue **v63** · APK y web sin cambios |
| Autor | Dirección del proyecto |

---

## 1. El defecto

La lógica de negocio usaba `date.today()` —la fecha del **servidor**, que corre en
UTC— en lugar de `hoy_operativo()` (la jornada de `America/Caracas`, UTC-4, D-94):

| Módulo | Qué decidía con la fecha del servidor |
|---|---|
| `api/routes_despachos.py` (6 usos) | la fecha por defecto de la propuesta, la generación del despacho, el proceso, la asignación, la reasignación y el reporte |
| `api/routes_config.py` (3 usos) | los tableros y los rangos de configuración |
| `services/sync.py` | la ventana de «trabajo reciente» de D-123 |
| `services/mensajes.py` | el día de los mensajes |

Entre las **20:00 y las 24:00** de Caracas el servidor ya está en «mañana»: el
despacho «de hoy», la jornada y la ventana de reasignación podían apuntar al día
equivocado durante esa franja.

---

## 2. Corrección

Sustitución de `date.today()` por `hoy_operativo()` en **todos** los módulos de
negocio (`app/services/*.py`, `app/api/*.py`), con su import. La fecha del servidor
queda solo donde se registra un instante (logs/auditoría).

Las **pruebas** también usan `hoy_operativo()` al crear «el despacho de hoy», para
que no dependan del reloj del servidor (y no fallen alrededor de la medianoche).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **482/482 en verde** (4 nuevas de D-131) |
| Pruebas nuevas | **guarda estática**: ningún módulo de `services/` o `api/` vuelve a usar `date.today()`; `hoy_operativo()` es el día de Caracas; `POST /despachos/propuesta` sin `fecha` usa `hoy_operativo()` (con el reloj inyectado); la conversión 21:30 de Caracas = día siguiente en UTC queda documentada |
| APK / web | sin cambios |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/api/routes_despachos.py`, `app/api/routes_config.py` | `hoy_operativo()` en lugar de `date.today()`. |
| `app/services/sync.py`, `app/services/mensajes.py` | Ídem. |
| `app/tests/*` (13 archivos) | El «día de hoy» de las pruebas sale de `hoy_operativo()`. |
| `app/tests/test_d131_dia_operativo.py` | **Nuevo**: guarda estática y prueba funcional. |

---

## 5. Siguiente hallazgo

**H-15** — la purga de despachos protege **7 de las 8** acciones que se pueden
encolar: una acción de un tipo no protegido puede perder su caso local al purgar.
Se consulta al usuario.

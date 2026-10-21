"""Módulo MASIVAS — RF-58…RF-62 · D-99.

Reúne la lógica que antes estaba dispersa entre `routes_alertas` (ficha y
materiales) y la deducción implícita de `clave_concentracion`:

* **asociación explícita** caso ↔ masiva (`falla_masiva_caso`, DEC-MA-1);
* **CASOS ASOCIADOS** con sus datos técnicos y la RUTA (columna `extra`);
* **cierre en cascada** (descripción + validador del CRASS + evidencias), que
  cierra cada caso asociado con la misma vía que el cierre individual;
* **ubicación** del FAT afectado para el mapa de la sección MASIVAS.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.orm import Session

from ..models import (
    Actividad,
    Caso,
    Cuadrilla,
    Despacho,
    DespachoCasos,
    Evidencia,
    FallaMasiva,
    FallaMasivaCaso,
    Sector,
    Solicitante,
    Usuario,
)
from ..schemas.alertas import CasoAsociadoOut, UbicacionOut
from . import geocodificacion, resolucion

#: Columnas por las que la detección automática reconoce la concentración.
CAMPOS_CONCENTRACION = {"olt": Caso.olt, "fat": Caso.fat, "id_sector": Caso.id_sector}

#: Descripción que queda en cada caso asociado al cerrar la masiva (RF-62).
DESCRIPCION_CIERRE_CASO = "Reparado en FDT"


class MasivaInvalida(Exception):
    """La operación no procede sobre la masiva indicada."""

    def __init__(self, mensaje: str, *, no_encontrada: bool = False) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.no_encontrada = no_encontrada


def ruta_de_caso(caso: Caso | None) -> str | None:
    """RUTA del caso (RF-59).

    En el archivo de ingesta la ruta viaja **en la columna EXTRA**; cuando viene
    vacía se compone con Tarjeta (slot) · Puerto · FAT, que es el criterio D-75.
    """
    if caso is None:
        return None
    extra = (caso.extra or "").strip()
    if extra:
        return extra
    partes = [p for p in (caso.slot, caso.puerto, caso.fat) if p]
    return " · ".join(partes) or None


def _texto_evidencias(seriales: list[str]) -> str | None:
    limpios = [s.strip()[:120] for s in seriales if s and s.strip()]
    return ", ".join(limpios[:20]) or None


# --------------------------------------------------------------------------- #
# Asociación caso ↔ masiva
# --------------------------------------------------------------------------- #
def _norm(valor: object) -> str:
    """Normaliza OLT/slot/puerto/FAT para comparar sin espacios ni mayúsculas."""
    return "" if valor is None else str(valor).strip().casefold()


def _tupla_completa(falla: FallaMasiva) -> bool:
    return all(
        _norm(getattr(falla, campo))
        for campo in ("olt", "slot", "puerto", "fat")
    )


def coincide(caso: Caso, falla: FallaMasiva) -> bool:
    """D-118: ¿el caso pertenece al FAT de la masiva?

    Con la tupla completa (OLT + slot + puerto + FAT) se exigen **los cuatro**
    valores. En masivas históricas sin la tupla se comparan solo los campos que
    la falla tenga (FAT/OLT), para no bloquear el cierre de datos viejos.
    """
    if _tupla_completa(falla):
        return all(
            _norm(getattr(caso, campo)) == _norm(getattr(falla, campo))
            for campo in ("olt", "slot", "puerto", "fat")
        )
    comparables = [
        campo for campo in ("olt", "slot", "puerto", "fat")
        if _norm(getattr(falla, campo))
    ]
    if not comparables:
        return True
    return all(
        _norm(getattr(caso, campo)) == _norm(getattr(falla, campo))
        for campo in comparables
    )


def _condicion_tupla(falla: FallaMasiva) -> ColumnElement[bool] | None:
    """Condición SQL de la tupla OLT+slot+puerto+FAT (D-118)."""
    if _tupla_completa(falla):
        return and_(
            func.lower(func.trim(Caso.olt)) == _norm(falla.olt),
            func.lower(func.trim(Caso.slot)) == _norm(falla.slot),
            func.lower(func.trim(Caso.puerto)) == _norm(falla.puerto),
            func.lower(func.trim(Caso.fat)) == _norm(falla.fat),
        )
    if _norm(falla.fat):
        return func.lower(func.trim(Caso.fat)) == _norm(falla.fat)
    if _norm(falla.olt):
        return func.lower(func.trim(Caso.olt)) == _norm(falla.olt)
    return None


def concentracion(db: Session, falla: FallaMasiva) -> list[Caso]:
    """Casos que alcanza la concentración que originó la falla.

    D-118: la identidad es la tupla **OLT + slot + puerto + FAT**. Solo se cae al
    criterio histórico `clave_concentracion` cuando la masiva no tiene tupla
    (datos anteriores a D-118). **Nunca** se usa el sector: una masiva no puede
    arrastrar todos los casos de la cuadrilla.
    """
    condiciones = [Caso.id_central == falla.id_central]
    tupla = _condicion_tupla(falla)
    if tupla is not None:
        condiciones.append(tupla)
    elif falla.clave_concentracion and ":" in falla.clave_concentracion:
        campo, valor = falla.clave_concentracion.split(":", 1)
        columna = CAMPOS_CONCENTRACION.get(campo or "")
        if columna is None:
            return []
        if columna is Caso.id_sector:
            try:
                condiciones.append(columna == int(str(valor)))
            except ValueError:
                return []
        else:
            condiciones.append(columna == valor)
    else:
        return []
    return list(db.scalars(select(Caso).where(*condiciones).order_by(Caso.id_caso)).all())


def sincronizar_asociacion(db: Session, falla: FallaMasiva, usuario_p00: str | None = None,
                           origen: str = "AUTO") -> int:
    """Materializa en `falla_masiva_caso` la concentración de la falla.

    Idempotente: solo inserta los vínculos que falten. Devuelve cuántos creó.
    """
    ya = set(db.scalars(
        select(FallaMasivaCaso.id_caso).where(FallaMasivaCaso.id_falla == falla.id_falla)
    ).all())
    creados = 0
    for caso in concentracion(db, falla):
        if caso.id_caso in ya:
            continue
        db.add(FallaMasivaCaso(
            id_falla=falla.id_falla, id_caso=caso.id_caso,
            origen=origen, agregado_por=usuario_p00,
        ))
        caso.es_falla_masiva = True
        creados += 1
    if creados:
        db.flush()
    return creados


def asociar(db: Session, falla: FallaMasiva, ids_caso: list[int],
            usuario_p00: str | None = None, origen: str = "MANUAL") -> int:
    """Asocia casos concretos a la masiva (agregado manual)."""
    if falla.estado == "CERRADA":
        raise MasivaInvalida("No se pueden asociar casos a una masiva cerrada")
    ya = set(db.scalars(
        select(FallaMasivaCaso.id_caso).where(FallaMasivaCaso.id_falla == falla.id_falla)
    ).all())
    creados = 0
    for id_caso in ids_caso:
        if id_caso in ya:
            continue
        caso = db.get(Caso, id_caso)
        if caso is None or caso.id_central != falla.id_central:
            raise MasivaInvalida(f"El caso {id_caso} no existe en la central de la masiva")
        if not coincide(caso, falla):
            raise MasivaInvalida(
                f"El caso {caso.id_averia} no coincide con OLT/slot/puerto/FAT de la masiva"
            )
        db.add(FallaMasivaCaso(
            id_falla=falla.id_falla, id_caso=id_caso, origen=origen, agregado_por=usuario_p00,
        ))
        caso.es_falla_masiva = True
        ya.add(id_caso)
        creados += 1
    db.flush()
    return creados


def desasociar(db: Session, falla: FallaMasiva, ids_caso: list[int]) -> int:
    """Quita casos de la masiva y recalcula la marca `es_falla_masiva` del caso."""
    vinculos = list(db.scalars(
        select(FallaMasivaCaso).where(
            FallaMasivaCaso.id_falla == falla.id_falla,
            FallaMasivaCaso.id_caso.in_(ids_caso),
        )
    ).all())
    for vinculo in vinculos:
        db.delete(vinculo)
    db.flush()
    for id_caso in ids_caso:
        _recalcular_marca(db, id_caso)
    return len(vinculos)


def _recalcular_marca(db: Session, id_caso: int) -> None:
    """`caso.es_falla_masiva` es verdadero mientras tenga algún vínculo vigente."""
    caso = db.get(Caso, id_caso)
    if caso is None:
        return
    queda = db.scalar(
        select(FallaMasivaCaso.id_asociacion)
        .where(FallaMasivaCaso.id_caso == id_caso)
        .limit(1)
    )
    caso.es_falla_masiva = queda is not None


def _cuadrilla_por_caso(db: Session, ids_caso: list[int]) -> dict[int, tuple[int, str, str]]:
    """Cuadrilla del despacho **más reciente** de cada caso."""
    if not ids_caso:
        return {}
    filas = db.execute(
        select(DespachoCasos.id_caso, Cuadrilla.id_cuadrilla, Cuadrilla.codigo,
               Cuadrilla.nombre, Despacho.fecha)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .join(Cuadrilla, Cuadrilla.id_cuadrilla == Despacho.id_cuadrilla)
        .where(DespachoCasos.id_caso.in_(ids_caso))
        .order_by(Despacho.fecha.desc())
    ).all()
    salida: dict[int, tuple[int, str, str]] = {}
    for id_caso, id_cuadrilla, codigo, nombre, _fecha in filas:
        salida.setdefault(id_caso, (id_cuadrilla, codigo, nombre))
    return salida


def casos_asociados(db: Session, falla: FallaMasiva) -> list[CasoAsociadoOut]:
    """CASOS ASOCIADOS de la ficha (RF-59)."""
    vinculos = list(db.scalars(
        select(FallaMasivaCaso)
        .where(FallaMasivaCaso.id_falla == falla.id_falla)
        .order_by(FallaMasivaCaso.id_asociacion)
    ).all())
    if not vinculos:
        return []
    ids = [v.id_caso for v in vinculos]
    casos = {c.id_caso: c for c in db.scalars(select(Caso).where(Caso.id_caso.in_(ids))).all()}
    sectores = {s.id_sector: s.nombre for s in db.scalars(select(Sector)).all()}
    cuadrillas = _cuadrilla_por_caso(db, ids)
    salida: list[CasoAsociadoOut] = []
    for vinculo in vinculos:
        caso = casos.get(vinculo.id_caso)
        if caso is None:
            continue
        id_cu, codigo, nombre_cu = cuadrillas.get(caso.id_caso, (None, None, None))
        salida.append(CasoAsociadoOut(
            id_caso=caso.id_caso,
            id_averia=caso.id_averia,
            estado_actual=caso.estado_actual,
            nombre_cliente=caso.nombre_cliente,
            telefono=caso.telefono,
            direccion=caso.direccion,
            id_sector=caso.id_sector,
            sector_nombre=sectores.get(caso.id_sector) if caso.id_sector else None,
            olt=caso.olt,
            slot=caso.slot,
            puerto=caso.puerto,
            fat=caso.fat,
            extra=caso.extra,
            ruta=ruta_de_caso(caso),
            id_cuadrilla=id_cu,
            cuadrilla_codigo=codigo,
            cuadrilla_nombre=nombre_cu,
            origen_asociacion=vinculo.origen,
        ))
    return salida


def contar_asociados(db: Session, ids_falla: list[int]) -> dict[int, int]:
    """Nº de casos asociados por falla (para la tabla y la ficha)."""
    if not ids_falla:
        return {}
    filas = db.execute(
        select(FallaMasivaCaso.id_falla, FallaMasivaCaso.id_asociacion)
        .where(FallaMasivaCaso.id_falla.in_(ids_falla))
    ).all()
    conteo: dict[int, int] = {}
    for id_falla, _ in filas:
        conteo[id_falla] = conteo.get(id_falla, 0) + 1
    return conteo


# --------------------------------------------------------------------------- #
# Cierre en cascada
# --------------------------------------------------------------------------- #
def cerrar(db: Session, falla: FallaMasiva, datos, usuario: Usuario) -> dict:
    """Cierra la masiva y **solo sus casos asociados** (RF-61 · RF-62 · D-118).

    Exige descripción del trabajo, validador del CRASS y evidencias. Cada caso
    asociado se cierra con `CERRAR` + el modo indicado (IVR por defecto) y la
    descripción «Reparado en FDT», salvo los que ya estén cerrados o **no
    coincidan con OLT + slot + puerto + FAT**, que se omiten. **Nunca** se cierran
    los casos de la cuadrilla que no estén asociados a la masiva.

    **No hace `commit`**: la operación completa es una sola transacción.
    """
    if falla.estado == "CERRADA":
        raise MasivaInvalida("La masiva ya está cerrada")
    validador = db.get(Solicitante, datos.id_validador_crass)
    if validador is None:
        raise MasivaInvalida("El validador del CRASS indicado no existe",
                             no_encontrada=True)
    if not validador.activo:
        raise MasivaInvalida("El validador del CRASS indicado está inactivo")

    ids = list(db.scalars(
        select(FallaMasivaCaso.id_caso).where(FallaMasivaCaso.id_falla == falla.id_falla)
    ).all())
    if not ids:
        raise MasivaInvalida(
            "La masiva no tiene casos asociados: asocie al menos uno antes de cerrar"
        )

    cerrados = omitidos = 0
    detalle: list[dict] = []
    for id_caso in ids:
        caso = db.get(Caso, id_caso)
        if caso is None:
            omitidos += 1
            detalle.append({"id_caso": id_caso, "resultado": "OMITIDO",
                            "motivo": "El caso ya no existe"})
            continue
        # D-118: solo se cierran los casos que coinciden con la tupla de la
        # masiva. Nunca se tocan los casos de la cuadrilla que no estén asociados.
        if not coincide(caso, falla):
            omitidos += 1
            detalle.append({
                "id_caso": caso.id_caso,
                "id_averia": caso.id_averia,
                "resultado": "OMITIDO",
                "motivo": "El caso no coincide con OLT/slot/puerto/FAT de la masiva",
            })
            continue
        try:
            resolucion.cerrar_caso(
                db, caso,
                modo=datos.modo,
                descripcion=datos.descripcion_caso or DESCRIPCION_CIERRE_CASO,
                evidencias=datos.evidencias,
                id_causa=datos.id_causa,
                usuario=usuario,
            )
        except resolucion.CierreInvalido as exc:
            omitidos += 1
            detalle.append({"id_caso": caso.id_caso, "id_averia": caso.id_averia,
                            "resultado": "OMITIDO", "motivo": exc.mensaje})
        else:
            cerrados += 1
            detalle.append({"id_caso": caso.id_caso, "id_averia": caso.id_averia,
                            "resultado": "CERRADO"})

    falla.estado = "CERRADA"
    falla.descripcion_cierre = datos.descripcion
    falla.id_validador_crass = validador.id_solicitante
    falla.evidencias_cierre = _texto_evidencias(datos.evidencias)
    falla.cerrada_por = usuario.p00
    falla.cerrada_en = datetime.now(UTC)
    falla.casos_cerrados = cerrados
    if datos.latitud is not None:
        falla.latitud = datos.latitud
    if datos.longitud is not None:
        falla.longitud = datos.longitud
    db.flush()
    return {
        "id_falla": falla.id_falla,
        "estado": falla.estado,
        "casos_cerrados": cerrados,
        "casos_omitidos": omitidos,
        "detalle": detalle,
    }


# --------------------------------------------------------------------------- #
# Ubicación del FAT afectado (RF-60)
# --------------------------------------------------------------------------- #
def _puntos_gps(db: Session, falla: FallaMasiva, ids_caso: list[int]) -> list[dict]:
    """Puntos GPS de las evidencias de la masiva y de sus casos asociados."""
    seriales = [s.strip() for s in (falla.evidencias or "").split(",") if s.strip()]
    #: `ColumnElement` (no `BinaryExpression`): `or_(...)` no es una comparación.
    condiciones: list[ColumnElement[bool]] = []
    if seriales and ids_caso:
        condiciones.append(or_(Evidencia.serial_imagen.in_(seriales),
                               Evidencia.id_actividad.in_(
                                   select(Actividad.id_actividad).where(
                                       Actividad.id_caso.in_(ids_caso)))))
    elif seriales:
        condiciones.append(Evidencia.serial_imagen.in_(seriales))
    elif ids_caso:
        condiciones.append(Evidencia.id_actividad.in_(
            select(Actividad.id_actividad).where(Actividad.id_caso.in_(ids_caso))))
    else:
        return []

    filas = db.execute(
        select(Evidencia)
        .where(*condiciones, Evidencia.latitud.is_not(None), Evidencia.longitud.is_not(None))
        .order_by(Evidencia.fecha_hora.desc())
        .limit(50)
    ).scalars().all()
    puntos: list[dict] = []
    for ev in filas:
        puntos.append({
            "tipo": "EVIDENCIA",
            "serial": ev.serial_imagen,
            "latitud": float(ev.latitud) if ev.latitud is not None else None,
            "longitud": float(ev.longitud) if ev.longitud is not None else None,
            "fecha_hora": ev.fecha_hora.isoformat() if ev.fecha_hora else None,
        })
    return puntos


def ubicacion(db: Session, falla: FallaMasiva) -> UbicacionOut:
    """Ubicación geográfica y GPS del FAT afectado (RF-60)."""
    ids_caso = list(db.scalars(
        select(FallaMasivaCaso.id_caso).where(FallaMasivaCaso.id_falla == falla.id_falla)
    ).all())
    sector = db.get(Sector, falla.id_sector) if falla.id_sector else None
    representativo = concentracion(db, falla)[:1]
    caso = representativo[0] if representativo else None

    lat = float(falla.latitud) if falla.latitud is not None else None
    lon = float(falla.longitud) if falla.longitud is not None else None
    puntos = _puntos_gps(db, falla, ids_caso)
    origen = "MASIVA" if lat is not None and lon is not None else "SIN_DATOS"
    if lat is None or lon is None:
        for punto in puntos:
            if punto["latitud"] is not None and punto["longitud"] is not None:
                lat, lon = punto["latitud"], punto["longitud"]
                origen = "EVIDENCIA"
                break
    direccion = falla.direccion or (caso.direccion if caso else None)
    consulta = geocodificacion.normalizar_consulta(
        direccion, sector.nombre if sector else None, f"FAT {falla.fat}" if falla.fat else None
    )
    return UbicacionOut(
        id_falla=falla.id_falla,
        latitud=lat,
        longitud=lon,
        direccion=direccion,
        ruta=ruta_de_caso(caso),
        olt=caso.olt if caso else None,
        fat=falla.fat or (caso.fat if caso else None),
        sector_nombre=sector.nombre if sector else None,
        origen=origen,
        puntos=puntos,
        # D-145: los enlaces del mapa se calculan aquí para que la pantalla no
        # tenga que saber construir URLs ni depender de una clave de mapas.
        url_mapa=geocodificacion.url_mapa(lat, lon),
        url_busqueda=geocodificacion.url_busqueda(consulta),
    )

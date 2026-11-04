"""D-168 · Identidad técnica de 5 campos en las fallas masivas (masivas FAT).

Petición del usuario: «optimiza la creación automática de averías masivas; los
casos asociados a una masiva deben poseer los datos técnicos (OLT, SLOT,
PUERTO, FAT, EXTRA) idénticos para corroborar que pertenecen al mismo FAT; al
cerrar la masiva se debe cerrar solo los casos asociados a ella; si existen 3
o más casos con las mismas características técnicas se crea una masiva
automáticamente».

Cubre:

* **3 o más** casos con la identidad técnica idéntica → masiva automática
  (umbral baja de 5 a 3) con los 5 campos y el EXTRA del representativo;
* con **2** casos no se crea nada;
* el mismo FAT con **EXTRA distinto** no agrupa (para corroborar el mismo FAT);
* casos **sin EXTRA** no agrupan (identidad incompleta);
* asociar a mano rechaza un caso con EXTRA distinto;
* los casos asociados reportan su EXTRA:
* el cierre omite el caso vinculado cuyo EXTRA difiere y **no** toca un caso
  con identidad idéntica que no esté asociado (el cierre es solo asociados);
* la detección es idempotente.

Los identificadores empiezan por `TSTD168` para el aseo del `conftest`.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Caso, FallaMasiva, FallaMasivaCaso

MASIVAS = "/api/v1/fallas-masivas"
CASOS = "/api/v1/casos"
PER = "/api/v1/solicitantes"

#: Identidad técnica completa de la masiva de pruebas (5 campos, D-168).
TUP5 = {"olt": "OLT-D168", "slot": "4", "puerto": "8",
        "fat": "FAT-D168", "extra": "RUTA-D168/A"}


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Casos de la central del administrador + ayudantes fijar/crear."""
    headers = admin_token["admin"]

    def crear(id_averia: str) -> dict:
        r = client.post(CASOS, json={
            "id_averia": id_averia, "direccion": "SECTOR D168 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04147771668", "id_pago": "7000000000",
            "tipo_reporte": "REPARACION", "tipo_problema": "SIN_SERVICIO",
        }, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    def fijar(ids_caso: list[int], **campos) -> None:
        """Campos técnicos que la vía manual no acepta (como en la ingesta)."""
        for id_caso in ids_caso:
            caso = db_session.get(Caso, id_caso)
            for campo, valor in campos.items():
                setattr(caso, campo, valor)
        db_session.commit()

    yield {"headers": headers, "crear": crear, "fijar": fijar}


def _masiva_cinco(client, headers, ids_caso: list[int]) -> dict:
    """Alta manual con la identidad completa (los 5 campos) y sus casos."""
    r = client.post(MASIVAS, json={
        "descripcion": "Falla masiva D-168 de las mismas características",
        **TUP5,
        "direccion": "SECTOR D168 CASA 1",
        "ids_caso": ids_caso,
    }, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _vinculos(db_session, id_falla: int) -> set[int]:
    return set(db_session.scalars(
        select(FallaMasivaCaso.id_caso).where(FallaMasivaCaso.id_falla == id_falla)
    ).all())


# --------------------------------------------------------------------------- #
# 1. Detección automática con la tupla de 5 campos y umbral 3
# --------------------------------------------------------------------------- #
def test_con_tres_casos_identicos_se_crea_la_masiva(client, entorno, db_session):
    """3 casos con OLT+slot+puerto+FAT+EXTRA idénticos → una masiva (umbral 3)."""
    casos = [entorno["crear"](f"TSTD168-A{i}") for i in range(3)]
    entorno["fijar"]([c["id_caso"] for c in casos], **TUP5)

    r = client.post(f"{MASIVAS}/detectar", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    creadas = [f for f in r.json() if f["clave_concentracion"] == "fat:FAT-D168"]
    assert len(creadas) == 1, r.text
    falla = creadas[0]
    # La identidad técnica de la masiva trae los 5 campos (D-168).
    assert falla["olt"] == TUP5["olt"] and falla["slot"] == TUP5["slot"]
    assert falla["puerto"] == TUP5["puerto"] and falla["fat"] == TUP5["fat"]
    assert falla["extra"] == TUP5["extra"]
    assert "EXTRA" in falla["descripcion"]
    assert falla["casos_asociados"] == 3

    filas = db_session.scalars(
        select(FallaMasivaCaso).where(FallaMasivaCaso.id_falla == falla["id_falla"])
    ).all()
    assert {f.id_caso for f in filas} == {c["id_caso"] for c in casos}

    # Detección idempotente: la misma tupla no vuelve a crear masiva.
    otra = client.post(f"{MASIVAS}/detectar", headers=entorno["headers"])
    assert otra.status_code == 200
    assert otra.json() == []


def test_con_dos_casos_no_se_crea(client, entorno):
    """Bajo el umbral (3) no se declara masiva."""
    casos = [entorno["crear"](f"TSTD168-B{i}") for i in range(2)]
    entorno["fijar"]([c["id_caso"] for c in casos], **TUP5)
    r = client.post(f"{MASIVAS}/detectar", headers=entorno["headers"])
    assert r.status_code == 200
    assert r.json() == []


def test_el_extra_distinto_no_agrupa(client, entorno, db_session):
    """Mismo OLT+slot+puerto+FAT pero otra RUTA (EXTRA) → NO es el mismo FAT."""
    mismo = [entorno["crear"](f"TSTD168-C{i}") for i in range(3)]
    entorno["fijar"]([c["id_caso"] for c in mismo], **TUP5)
    distinta = [entorno["crear"](f"TSTD168-CX{i}") for i in range(2)]
    entorno["fijar"]([c["id_caso"] for c in distinta],
                     **{**TUP5, "extra": "RUTA-D168/B"})

    r = client.post(f"{MASIVAS}/detectar", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    falla = db_session.scalar(select(FallaMasiva).where(
        FallaMasiva.fat == TUP5["fat"], FallaMasiva.id_central ==
        db_session.get(Caso, mismo[0]["id_caso"]).id_central))
    assert falla is not None and falla.extra == TUP5["extra"]
    # Solo los 3 del EXTRA idéntico quedaron asociados.
    assert _vinculos(db_session, falla.id_falla) == {c["id_caso"] for c in mismo}


def test_casos_sin_extra_no_agrupan(client, entorno):
    """Identidad incompleta (EXTRA vacío): la masiva no se declara."""
    casos = [entorno["crear"](f"TSTD168-D{i}") for i in range(4)]
    entorno["fijar"]([c["id_caso"] for c in casos],
                     **{k: v for k, v in TUP5.items() if k != "extra"})
    r = client.post(f"{MASIVAS}/detectar", headers=entorno["headers"])
    assert r.status_code == 200
    assert r.json() == []


# --------------------------------------------------------------------------- #
# 2. Asociación y datos de los casos asociados
# --------------------------------------------------------------------------- #
def test_asociar_rechaza_un_caso_con_extra_distinto(client, entorno, db_session):
    """D-168: la asociación manual valida los 5 campos de la identidad."""
    headers = entorno["headers"]
    dentro = entorno["crear"]("TSTD168-E1")
    foraneo = entorno["crear"]("TSTD168-E2")
    entorno["fijar"]([dentro["id_caso"]], **TUP5)
    entorno["fijar"]([foraneo["id_caso"]],
                     **{**TUP5, "extra": "RUTA-D168/OTRA"})
    falla = _masiva_cinco(client, headers, [dentro["id_caso"]])

    r = client.post(f"{MASIVAS}/{falla['id_falla']}/casos",
                    json={"ids_caso": [foraneo["id_caso"]]}, headers=headers)
    assert r.status_code == 409, r.text
    assert "EXTRA" in r.json()["detail"]
    assert _vinculos(db_session, falla["id_falla"]) == {dentro["id_caso"]}


def test_los_casos_asociados_reportan_su_extra(client, entorno):
    """RF-59: el EXTRA de cada caso sale en CASOS ASOCIADOS (para corroborar)."""
    headers = entorno["headers"]
    dentro = entorno["crear"]("TSTD168-F1")
    entorno["fijar"]([dentro["id_caso"]], **TUP5)
    falla = _masiva_cinco(client, headers, [dentro["id_caso"]])

    r = client.get(f"{MASIVAS}/{falla['id_falla']}/casos", headers=headers)
    assert r.status_code == 200, r.text
    asociados = r.json()
    assert [a["id_caso"] for a in asociados] == [dentro["id_caso"]]
    assert asociados[0]["extra"] == TUP5["extra"]
    assert asociados[0]["ruta"] == TUP5["extra"]


# --------------------------------------------------------------------------- #
# 3. Cierre en cascada: solo los asociados y solo los del mismo FAT
# --------------------------------------------------------------------------- #
def test_el_cierre_omite_el_caso_de_otro_extra_y_no_toca_al_no_asociado(
        client, entorno, db_session):
    """RF-61/62 · D-168: se cierran **solo** los asociados con identidad igual."""
    headers = entorno["headers"]
    bueno1 = entorno["crear"]("TSTD168-G1")
    bueno2 = entorno["crear"]("TSTD168-G2")
    raro = entorno["crear"]("TSTD168-G3")    # mismo FAT, otra RUTA (EXTRA)
    fuera = entorno["crear"]("TSTD168-G4")   # identidad idéntica pero NO asociado
    entorno["fijar"]([bueno1["id_caso"], bueno2["id_caso"], fuera["id_caso"]], **TUP5)
    entorno["fijar"]([raro["id_caso"]], **{**TUP5, "extra": "RUTA-D168/OTRA"})

    falla = _masiva_cinco(client, headers, [bueno1["id_caso"], bueno2["id_caso"]])
    # Vínculo incoherente (simula un dato viejito): el caso de otro EXTRA.
    db_session.add(FallaMasivaCaso(
        id_falla=falla["id_falla"], id_caso=raro["id_caso"], origen="MANUAL"))
    db_session.commit()

    validador = client.post(PER, json={
        "nombre": "CRASS D168", "unidad": "CRASS MIRANDA",
        "contacto": "02121234567", "tipo": "CRASS"}, headers=headers)
    assert validador.status_code == 201, validador.text

    r = client.post(f"{MASIVAS}/{falla['id_falla']}/cierre", json={
        "descripcion": "Se reparó el tramo del FAT afectado en sitio",
        "id_validador_crass": validador.json()["id_solicitante"],
        "evidencias": ["EVID-D168-1.jpg"]}, headers=headers)
    assert r.status_code == 200, r.text
    resultado = r.json()
    assert resultado["estado"] == "CERRADA"
    assert resultado["casos_cerrados"] == 2
    assert resultado["casos_omitidos"] == 1
    abandonado = next(d for d in resultado["detalle"]
                      if d["id_caso"] == raro["id_caso"])
    assert abandonado["resultado"] == "OMITIDO"
    assert "EXTRA" in (abandonado.get("motivo") or "")

    db_session.expire_all()
    # Los asociados del mismo FAT quedan cerrados...
    assert db_session.get(Caso, bueno1["id_caso"]).estado_actual == "CERRADO"
    assert db_session.get(Caso, bueno2["id_caso"]).estado_actual == "CERRADO"
    # el vinculado con EXTRA distinto se omite...
    assert db_session.get(Caso, raro["id_caso"]).estado_actual != "CERRADO"
    # y el caso con identidad idéntica pero NO asociado no se toca: el cierre
    # es **solo** sobre los vínculos de falla_masiva_caso.
    assert db_session.get(Caso, fuera["id_caso"]).estado_actual != "CERRADO"

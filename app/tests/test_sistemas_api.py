"""Pruebas de integración de SISTEMAS: inspección de la BD (solo SUPER, D-69)."""

from __future__ import annotations


# --------------------------------------------------------------------------- #
# SISTEMAS: inspección de la base de datos (D-69)
# --------------------------------------------------------------------------- #
def test_sistemas_estructura_solo_super(client, admin_token):
    """La sección es exclusiva del Super Usuario."""
    assert client.get("/api/v1/sistemas/estructura").status_code == 401
    assert client.get("/api/v1/sistemas/estructura",
                      headers=admin_token["admin"]).status_code == 403
    assert client.get("/api/v1/sistemas/estructura",
                      headers=admin_token["tecnico"]).status_code == 403
    assert client.get("/api/v1/sistemas/estructura",
                      headers=admin_token["supervisor"]).status_code == 403

    r = client.get("/api/v1/sistemas/estructura", headers=admin_token["super"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["total_tablas"] >= 35
    nombres = [t["tabla"] for t in cuerpo["tablas"]]
    assert "caso" in nombres and "cuadrilla_sector_dia" in nombres
    caso = next(t for t in cuerpo["tablas"] if t["tabla"] == "caso")
    assert caso["columnas"] > 40 and caso["claves_foraneas"] >= 1


def test_sistemas_detalle_y_contenido_ofuscado(client, admin_token):
    r = client.get("/api/v1/sistemas/tabla/usuario", headers=admin_token["super"])
    assert r.status_code == 200, r.text
    detalle = r.json()
    assert detalle["claves_primarias"] == ["id_usuario"]
    assert "clave_hash" in detalle["columnas_ofuscadas"]
    assert any(c["nombre"] == "p00" and c["es_clave"] is False for c in detalle["columnas"])

    r = client.get("/api/v1/sistemas/tabla/usuario/datos", params={"pagina": 1, "tamano": 5},
                   headers=admin_token["super"])
    assert r.status_code == 200, r.text
    contenido = r.json()
    assert contenido["tamano"] == 5 and contenido["total"] >= 3
    for fila in contenido["filas"]:
        assert str(fila["clave_hash"]).startswith("•••• hash no reversible")

    # Un rol distinto tampoco puede ver el contenido
    assert client.get("/api/v1/sistemas/tabla/usuario/datos",
                      headers=admin_token["admin"]).status_code == 403


def test_sistemas_rechaza_nombres_inseguros(client, admin_token):
    """El nombre de tabla se valida: nada de inyección ni tablas del catálogo."""
    assert client.get("/api/v1/sistemas/tabla/pg_shadow",
                      headers=admin_token["super"]).status_code == 404
    assert client.get("/api/v1/sistemas/tabla/caso; drop table usuario",
                      headers=admin_token["super"]).status_code == 404
    assert client.get("/api/v1/sistemas/tabla/noexiste",
                      headers=admin_token["super"]).status_code == 404

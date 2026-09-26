"""Generación de las 12 palabras de seguridad del dispositivo (RF-20 / brief 4.3.6)."""

from __future__ import annotations

import secrets

# Lista de palabras sencillas en español (sin tildes ni Ñ para teclearlas fácil).
PALABRAS = (
    "agua", "arbol", "arena", "avion", "barco", "blanco", "boca", "brazo", "cable", "cafe",
    "calle", "campo", "carta", "casa", "cielo", "cobre", "codo", "copa", "costa", "cruz",
    "dado", "dedo", "disco", "duna", "enero", "faro", "fiesta", "fuego", "gafas", "gallo",
    "gato", "gota", "hielo", "higo", "hilo", "hoja", "hueso", "isla", "jabon", "juego",
    "lago", "lampara", "lapiz", "libro", "lima", "llave", "luna", "madera", "mano", "mapa",
    "mesa", "metal", "miel", "monte", "muro", "naranja", "nave", "nieve", "nube", "nudo",
    "obra", "ocaso", "ola", "oro", "oso", "palma", "pan", "papel", "parque", "pasto",
    "pera", "piedra", "pino", "plata", "playa", "pluma", "pozo", "puente", "puerta", "queso",
    "rama", "raton", "rayo", "red", "reloj", "rio", "roca", "rosa", "rueda", "sal",
    "sello", "silla", "sol", "sombra", "sopa", "taza", "techo", "tierra", "tigre", "tiza",
    "toro", "trigo", "tubo", "uva", "vaca", "valle", "vela", "viento", "vidrio", "zapato",
)


def generar_palabras(cantidad: int = 12) -> list[str]:
    """Genera `cantidad` palabras únicas y aleatorias."""
    if cantidad > len(PALABRAS):
        raise ValueError("cantidad solicitada mayor que el diccionario disponible")
    return secrets.SystemRandom().sample(PALABRAS, cantidad)

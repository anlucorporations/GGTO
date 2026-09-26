"""Capa de acceso a datos (SQLAlchemy 2.x + psycopg2)."""

from collections.abc import Iterator
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    """Base declarativa de los modelos."""


def build_url() -> str:
    """Construye la URL de conexión.

    Soporta el socket de Cloud SQL (`DB_HOST=/cloudsql/proyecto:region:instancia`)
    y conexión TCP normal.
    """
    s = get_settings()
    user = quote_plus(s.db_user)
    pwd = quote_plus(s.db_password)
    if s.db_host.startswith("/"):
        # Socket Unix de Cloud SQL: el host va como parámetro de consulta.
        return (
            f"postgresql+psycopg2://{user}:{pwd}@/{s.db_name}"
            f"?host={quote_plus(s.db_host)}"
        )
    return (
        f"postgresql+psycopg2://{user}:{pwd}@{s.db_host}:{s.db_port}/{s.db_name}"
        f"?sslmode={s.db_sslmode}"
    )


engine = create_engine(build_url(), pool_pre_ping=True, pool_size=5, max_overflow=5, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión por petición."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

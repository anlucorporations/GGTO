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

    Soporta el socket de Cloud SQL (`DB_HOST=/cloudsql/proyecto:region:instancia`),
    conexión TCP normal y un esquema alternativo (`DB_SCHEMA`) para pruebas o
    entornos de preview, que se resuelve con `search_path`.
    """
    s = get_settings()
    user = quote_plus(s.db_user)
    pwd = quote_plus(s.db_password)
    if s.db_host.startswith("/"):
        # Socket Unix de Cloud SQL: el host va como parámetro de consulta.
        url = f"postgresql+psycopg2://{user}:{pwd}@/{s.db_name}"
        params = [f"host={quote_plus(s.db_host)}"]
    else:
        url = f"postgresql+psycopg2://{user}:{pwd}@{s.db_host}:{s.db_port}/{s.db_name}"
        params = [f"sslmode={s.db_sslmode}"]
    if s.db_schema:
        # `public` se mantiene para resolver las extensiones (pgcrypto, pg_trgm).
        params.append("options=" + quote_plus(f"-csearch_path={s.db_schema},public"))
    return f"{url}?{'&'.join(params)}"


engine = create_engine(build_url(), pool_pre_ping=True, pool_size=5, max_overflow=5, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión por petición."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

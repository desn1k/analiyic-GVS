"""Отдельная база данных для сырых почасовых данных с приборов учёта.

Держим её отдельно от основной аналитической БД (gvs.db), т.к. объёмы
принципиально другие — файлы до 1.5 ГБ, десятки миллионов почасовых записей,
которые нужны для будущего ML. Основная БД остаётся лёгкой.
"""
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

DEVICE_DATABASE_URL = os.environ.get("DEVICE_DATABASE_URL", "sqlite:///./device.db")

device_engine = create_engine(
    DEVICE_DATABASE_URL, connect_args={"check_same_thread": False}
)


@event.listens_for(device_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    """Ускоряем массовые вставки больших приборных файлов."""
    if DEVICE_DATABASE_URL.startswith("sqlite"):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        # SQLite — один писатель за раз; при параллельных загрузках писатель
        # ждёт освобождения блокировки, а не падает с "database is locked".
        cur.execute("PRAGMA busy_timeout=60000")
        cur.close()


DeviceSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=device_engine)
DeviceBase = declarative_base()


def get_device_db():
    db = DeviceSessionLocal()
    try:
        yield db
    finally:
        db.close()

from datetime import datetime

from sqlalchemy import (
    Column, Integer, BigInteger, String, Float, Date, DateTime, Boolean,
    ForeignKey, Index,
)

from app.device_database import DeviceBase


class DeviceUpload(DeviceBase):
    """Один загруженный файл почасовых данных с приборов учёта."""

    __tablename__ = "device_uploads"

    id = Column(Integer, primary_key=True)
    source_filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    points_count = Column(Integer, default=0)
    hours_count = Column(BigInteger, default=0)


class DevicePoint(DeviceBase):
    """Точка учёта (прибор). Ключ — GE-UUID из столбца GE отчёта."""

    __tablename__ = "device_points"

    id = Column(Integer, primary_key=True)
    tu_uuid = Column(String, nullable=False, index=True, unique=True)
    object_name = Column(String)
    device_name = Column(String)
    tu_name = Column(String)
    resource = Column(String)
    scheme = Column(String)
    last_upload_id = Column(Integer, ForeignKey("device_uploads.id"))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DeviceHourly(DeviceBase):
    """Одна почасовая запись прибора. Сырые данные для ML.

    Храним только «якорные» параметры отчёта (t1..t5, M1..M4, P1..P4, Q1..Q4, NS).
    valid=False — в исходнике стояло '---' (недостоверное показание) хотя бы по t1.
    """

    __tablename__ = "device_hourly"

    # На SQLite автоинкремент работает только для INTEGER PRIMARY KEY (rowid),
    # а не BIGINT — при этом INTEGER на SQLite всё равно 64-битный.
    id = Column(Integer, primary_key=True)
    tu_uuid = Column(String, nullable=False)
    upload_id = Column(Integer, ForeignKey("device_uploads.id"), nullable=False)
    ts = Column(DateTime, nullable=False)

    t1 = Column(Float)
    t2 = Column(Float)
    t3 = Column(Float)
    t4 = Column(Float)
    t5 = Column(Float)
    m1 = Column(Float)
    m2 = Column(Float)
    m3 = Column(Float)
    m4 = Column(Float)
    p1 = Column(Float)
    p2 = Column(Float)
    p3 = Column(Float)
    p4 = Column(Float)
    q1 = Column(Float)
    q2 = Column(Float)
    q3 = Column(Float)
    q4 = Column(Float)
    ns = Column(Float)
    valid = Column(Boolean, default=True)

    __table_args__ = (
        Index("ix_device_hourly_tu_ts", "tu_uuid", "ts"),
    )

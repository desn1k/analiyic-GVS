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
    kind = Column(String, default="device")  # device | outage
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    points_count = Column(Integer, default=0)
    hours_count = Column(BigInteger, default=0)
    status = Column(String, default="processing")  # processing | done | error
    error = Column(String, nullable=True)


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


class Outage(DeviceBase):
    """Строка ведомости отключений. Связь с объектом — по нормализованному адресу."""

    __tablename__ = "outages"

    id = Column(Integer, primary_key=True)
    upload_id = Column(Integer, ForeignKey("device_uploads.id"), nullable=False)

    number = Column(String)            # Номер отключения
    kind = Column(String)              # Тип: аварийное / плановое
    status = Column(String)            # Статус: исполнено / в работе
    impact = Column(String)            # факт: прекращение / ограничение
    address = Column(String)           # исходный адрес
    address_norm = Column(String, index=True)
    fias = Column(String)
    guid = Column(String, index=True)
    source = Column(String)            # Источник
    service_gvs = Column(Boolean, default=False)  # затрагивает ГВС
    reason = Column(String)            # Причина отключения
    load_gkal = Column(Float)          # Отключаемая нагрузка ГВС, Гкал/ч
    residents = Column(Integer)        # Количество жителей
    start_fact = Column(DateTime)      # Дата отключения (факт)
    end_fact = Column(DateTime)        # Дата включения (факт)
    start_plan = Column(DateTime)
    end_plan = Column(DateTime)
    note = Column(String)

    __table_args__ = (
        Index("ix_outages_addr_impact", "address_norm", "impact"),
    )


class ObjectRegistry(DeviceBase):
    """Паспорт объекта из реестра АИИС. Ключ — object_id (= object_id отчёта)."""

    __tablename__ = "object_registry"

    id = Column(Integer, primary_key=True)
    upload_id = Column(Integer, ForeignKey("device_uploads.id"))
    object_id = Column(String, nullable=False, index=True, unique=True)
    name = Column(String)              # Название объекта (AD)
    address = Column(String)           # Адрес объекта (F)
    address_norm = Column(String, index=True)
    design_t_supply = Column(Float)    # Расч. температура прямой (J)
    design_t_return = Column(Float)    # Расч. температура обратной (K)
    heat_system = Column(String)       # Система теплоснабжения (Z)
    q_heating = Column(Float)          # Qот (AE)
    q_gvs = Column(Float)              # Qгвс (AF)
    aiis_url = Column(String)          # Ссылка (CX)
    fias = Column(String)             # Код ФИАС (CV)


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

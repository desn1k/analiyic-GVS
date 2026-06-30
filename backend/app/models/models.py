from datetime import date, datetime

from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.database import Base


class ReportPeriod(Base):
    """Один загруженный отчёт 'Количество случаев нарушения качества ГВС' за период."""

    __tablename__ = "report_periods"

    id = Column(Integer, primary_key=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    generated_at = Column(DateTime, nullable=True)
    source_filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    rows = relationship("TuReportRow", back_populates="period", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("period_start", "period_end", "source_filename", name="uq_period_file"),
    )


class TuReportRow(Base):
    """Одна строка отчёта = одна точка учёта (ТУ) за период."""

    __tablename__ = "tu_report_rows"

    id = Column(Integer, primary_key=True)
    period_id = Column(Integer, ForeignKey("report_periods.id"), nullable=False)

    object_name = Column(String)
    tu_name = Column(String)
    object_id = Column(String, index=True)
    object_type = Column(String)
    tu_id = Column(String, index=True)
    source_name = Column(String)  # ЦТП/Источник

    avg_temp_ctp = Column(Float)  # Средняя температура ГВС ЦТП
    is_dead_end = Column(String)  # Сведения о тупиковой системе (да/нет)
    system_type = Column(String)  # Сведения о закрытой системе (Открытая/Закрытая)

    total_records = Column(Integer)
    valid_records = Column(Integer)
    avg_temp_gvs = Column(Float)  # Средняя температура ГВС

    contract_load = Column(Float)  # Договорная нагрузка ГВС, т/ч
    volume_total = Column(Float)  # Объём ГВС, м3
    volume_below_40 = Column(Float)
    volume_40_60 = Column(Float)
    volume_60_75 = Column(Float)
    volume_above_75 = Column(Float)

    hours_total = Column(Integer)
    hours_violation_low = Column(Integer)  # занижение
    hours_violation_high = Column(Integer)  # завышение

    flow_below_2pct = Column(Integer)
    check_no_data = Column(Integer)  # Q,M1,T1=н/д
    check_vnr = Column(Integer)
    check_m1_m2 = Column(Integer)
    check_qinj = Column(Integer)
    check_t_range = Column(Integer)  # T>=100 or T<=0
    check_t1_lt_t2 = Column(Integer)
    check_v_max = Column(Integer)
    check_t1_const = Column(Integer)
    check_t_other = Column(Integer)

    scheme = Column(String)

    period = relationship("ReportPeriod", back_populates="rows")

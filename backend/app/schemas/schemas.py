from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_start: date
    period_end: date
    generated_at: Optional[datetime] = None
    source_filename: str
    tu_count: int = 0


class TuRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    object_name: Optional[str]
    tu_name: Optional[str]
    object_id: Optional[str]
    object_type: Optional[str]
    tu_id: Optional[str]
    source_name: Optional[str]
    is_dead_end: Optional[str]
    system_type: Optional[str]
    scheme: Optional[str]
    total_records: Optional[int]
    valid_records: Optional[int]
    avg_temp_gvs: Optional[float]
    volume_total: Optional[float]
    volume_below_40: Optional[float]
    volume_40_60: Optional[float]
    volume_60_75: Optional[float]
    volume_above_75: Optional[float]
    hours_total: Optional[int]
    hours_violation_low: Optional[int]
    hours_violation_high: Optional[int]
    violation_volume: float = 0.0
    violation_pct: float = 0.0
    data_quality_pct: float = 0.0


class DynamicsPoint(BaseModel):
    period_id: int
    period_start: date
    period_end: date
    volume_total: float
    violation_volume: float
    violation_pct: float
    avg_temp_gvs: float
    hours_violation_low: int
    hours_violation_high: int
    tu_count: int


class FilterOptions(BaseModel):
    object_types: list[str]
    system_types: list[str]
    sources: list[str]


class WeeklySummary(BaseModel):
    period_id: int
    period_start: date
    period_end: date
    objects_count: int
    tu_count: int
    objects_with_violation: int
    volume_total: float
    violation_volume: float
    violation_pct: float
    overheat_count: int


class ObjectPeriodMetric(BaseModel):
    period_id: int
    volume_total: float
    violation_volume: float
    violation_pct: float
    avg_temp_gvs: float
    data_quality_pct: float
    has_overheat: bool


class ObjectComparisonRow(BaseModel):
    object_id: str
    object_name: str
    object_type: Optional[str] = None
    periods: dict[int, ObjectPeriodMetric]


class ObjectComparisonOut(BaseModel):
    periods: list[PeriodOut]
    objects: list[ObjectComparisonRow]

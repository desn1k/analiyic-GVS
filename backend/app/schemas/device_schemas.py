from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DevicePointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tu_uuid: str
    object_name: Optional[str] = None
    device_name: Optional[str] = None
    tu_name: Optional[str] = None
    resource: Optional[str] = None
    scheme: Optional[str] = None


class DeviceHourlyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ts: datetime
    t1: Optional[float] = None
    t2: Optional[float] = None
    t3: Optional[float] = None
    t4: Optional[float] = None
    t5: Optional[float] = None
    m1: Optional[float] = None
    m2: Optional[float] = None
    p1: Optional[float] = None
    q1: Optional[float] = None
    ns: Optional[float] = None
    valid: bool = True


class DevicePointSummary(BaseModel):
    tu_uuid: str
    point: Optional[DevicePointOut] = None
    hours_total: int = 0
    hours_valid: int = 0
    valid_pct: float = 0.0
    ts_min: Optional[datetime] = None
    ts_max: Optional[datetime] = None
    t1_avg: Optional[float] = None
    t1_min: Optional[float] = None
    t1_max: Optional[float] = None
    hours_below_40: int = 0
    hours_40_60: int = 0
    hours_60_75: int = 0
    hours_above_75: int = 0


class OutageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    number: Optional[str] = None
    kind: Optional[str] = None
    status: Optional[str] = None
    impact: Optional[str] = None
    address: Optional[str] = None
    source: Optional[str] = None
    service_gvs: bool = False
    reason: Optional[str] = None
    load_gkal: Optional[float] = None
    residents: Optional[int] = None
    start_fact: Optional[datetime] = None
    end_fact: Optional[datetime] = None
    note: Optional[str] = None


class DeviceUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_filename: str
    kind: str = "device"
    uploaded_at: Optional[datetime] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    points_count: int = 0
    hours_count: int = 0
    status: str = "done"
    error: Optional[str] = None

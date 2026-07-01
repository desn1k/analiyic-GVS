from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app.device_database import get_device_db
from app.models import (
    ReportPeriod, TuReportRow, DeviceUpload, DevicePoint, DeviceHourly,
)
from app.schemas.device_schemas import DeviceUploadOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(db: Session = Depends(get_db), ddb: Session = Depends(get_device_db)):
    # --- Недельные аналитические отчёты (gvs.db) ---
    periods_total = db.query(func.count(ReportPeriod.id)).scalar() or 0
    tu_rows_total = db.query(func.count(TuReportRow.id)).scalar() or 0
    objects_total = db.query(func.count(func.distinct(TuReportRow.object_id))).scalar() or 0
    rep_ts = db.query(func.min(ReportPeriod.period_start), func.max(ReportPeriod.period_end)).one()

    # --- Приборные почасовые данные (device.db) ---
    points_total = ddb.query(func.count(DevicePoint.id)).scalar() or 0
    uploads_total = ddb.query(func.count(DeviceUpload.id)).scalar() or 0

    hours_total, hours_valid, hours_no_t1 = ddb.query(
        func.count(DeviceHourly.id),
        func.sum(case((DeviceHourly.valid == True, 1), else_=0)),  # noqa: E712
        func.sum(case((DeviceHourly.t1.is_(None), 1), else_=0)),
    ).one()
    hours_total = hours_total or 0
    hours_valid = hours_valid or 0
    hours_no_t1 = hours_no_t1 or 0
    hours_invalid = hours_total - hours_valid

    dev_ts = ddb.query(func.min(DeviceHourly.ts), func.max(DeviceHourly.ts)).one()

    # Точки без единого достоверного часа (данные есть в структуре, но пустые).
    valid_per_point = (
        ddb.query(DeviceHourly.tu_uuid)
        .filter(DeviceHourly.valid == True)  # noqa: E712
        .group_by(DeviceHourly.tu_uuid)
        .count()
    )
    points_without_valid = points_total - valid_per_point

    uploads = ddb.query(DeviceUpload).order_by(DeviceUpload.uploaded_at.desc()).all()

    return {
        "report": {
            "periods_total": periods_total,
            "tu_rows_total": tu_rows_total,
            "objects_total": objects_total,
            "period_start": rep_ts[0],
            "period_end": rep_ts[1],
        },
        "device": {
            "points_total": points_total,
            "uploads_total": uploads_total,
            "hours_total": hours_total,
            "hours_valid": hours_valid,
            "hours_invalid": hours_invalid,
            "hours_no_t1": hours_no_t1,
            "valid_pct": round(hours_valid / hours_total * 100, 1) if hours_total else 0.0,
            "points_without_valid": points_without_valid,
            "ts_min": dev_ts[0],
            "ts_max": dev_ts[1],
            "uploads": [DeviceUploadOut.model_validate(u).model_dump() for u in uploads],
        },
    }

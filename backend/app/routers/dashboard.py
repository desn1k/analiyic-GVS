from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app.device_database import get_device_db
from app.models import (
    ReportPeriod, TuReportRow, DeviceUpload, DevicePoint, DeviceHourly, Outage,
    ObjectRegistry,
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

    # Достоверные/недостоверные часы по каждой точке.
    per_point = (
        ddb.query(
            DeviceHourly.tu_uuid,
            func.count(DeviceHourly.id),
            func.sum(case((DeviceHourly.valid == True, 1), else_=0)),  # noqa: E712
        )
        .group_by(DeviceHourly.tu_uuid)
        .all()
    )
    valid_map = {uuid: (total, valid or 0) for uuid, total, valid in per_point}
    name_map = {p.tu_uuid: p.object_name for p in ddb.query(DevicePoint).all()}

    points_no_data = []      # ни одного достоверного часа
    points_partial = []      # есть недостоверные (пустые) часы, но не всё
    for uuid, (total, valid) in valid_map.items():
        invalid = total - valid
        item = {
            "tu_uuid": uuid,
            "object_name": name_map.get(uuid),
            "hours_total": total,
            "hours_valid": valid,
            "hours_invalid": invalid,
            "invalid_pct": round(invalid / total * 100, 1) if total else 0.0,
        }
        if valid == 0:
            points_no_data.append(item)
        elif invalid > 0:
            points_partial.append(item)

    # Точки, которых вообще нет в почасовых данных (в meta есть, часов нет).
    for uuid, name in name_map.items():
        if uuid not in valid_map:
            points_no_data.append({
                "tu_uuid": uuid, "object_name": name,
                "hours_total": 0, "hours_valid": 0, "hours_invalid": 0, "invalid_pct": 100.0,
            })

    points_partial.sort(key=lambda x: x["invalid_pct"], reverse=True)
    points_no_data.sort(key=lambda x: (x["object_name"] or ""))
    points_without_valid = len(points_no_data)

    registry_total = ddb.query(func.count(ObjectRegistry.id)).scalar() or 0
    outages_total = ddb.query(func.count(Outage.id)).scalar() or 0
    outages_gvs = ddb.query(func.count(Outage.id)).filter(Outage.service_gvs == True).scalar() or 0  # noqa: E712

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
            "registry_total": registry_total,
            "outages_total": outages_total,
            "outages_gvs": outages_gvs,
            "ts_min": dev_ts[0],
            "ts_max": dev_ts[1],
            "uploads": [DeviceUploadOut.model_validate(u).model_dump() for u in uploads],
            "points_no_data": points_no_data[:500],
            "points_partial": points_partial[:500],
        },
    }

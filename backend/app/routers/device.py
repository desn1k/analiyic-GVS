from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.device_database import get_device_db
from app.models import DevicePoint, DeviceHourly, DeviceUpload
from app.schemas.device_schemas import (
    DevicePointOut, DeviceHourlyOut, DevicePointSummary, DeviceUploadOut,
)

router = APIRouter(prefix="/api/device", tags=["device"])


@router.get("/points/{tu_uuid}/exists")
def point_exists(tu_uuid: str, db: Session = Depends(get_device_db)):
    exists = db.query(DevicePoint.id).filter(DevicePoint.tu_uuid == tu_uuid).first() is not None
    return {"exists": exists}


@router.get("/points/{tu_uuid}/summary", response_model=DevicePointSummary)
def point_summary(tu_uuid: str, db: Session = Depends(get_device_db)):
    point = db.query(DevicePoint).filter(DevicePoint.tu_uuid == tu_uuid).first()

    agg = (
        db.query(
            func.count(DeviceHourly.id),
            func.sum(case((DeviceHourly.valid == True, 1), else_=0)),  # noqa: E712
            func.min(DeviceHourly.ts),
            func.max(DeviceHourly.ts),
            func.avg(DeviceHourly.t1),
            func.min(DeviceHourly.t1),
            func.max(DeviceHourly.t1),
            func.sum(case((DeviceHourly.t1 < 40, 1), else_=0)),
            func.sum(case(((DeviceHourly.t1 >= 40) & (DeviceHourly.t1 < 60), 1), else_=0)),
            func.sum(case(((DeviceHourly.t1 >= 60) & (DeviceHourly.t1 <= 75), 1), else_=0)),
            func.sum(case((DeviceHourly.t1 > 75, 1), else_=0)),
        )
        .filter(DeviceHourly.tu_uuid == tu_uuid, DeviceHourly.valid == True)  # noqa: E712
        .one()
    )
    total_all = db.query(func.count(DeviceHourly.id)).filter(DeviceHourly.tu_uuid == tu_uuid).scalar() or 0

    (cnt, valid, ts_min, ts_max, t1_avg, t1_min, t1_max,
     h_below, h_40_60, h_60_75, h_above) = agg
    cnt = cnt or 0
    valid = valid or 0

    return DevicePointSummary(
        tu_uuid=tu_uuid,
        point=DevicePointOut.model_validate(point) if point else None,
        hours_total=total_all,
        hours_valid=valid,
        valid_pct=round(valid / total_all * 100, 1) if total_all else 0.0,
        ts_min=ts_min, ts_max=ts_max,
        t1_avg=round(t1_avg, 2) if t1_avg is not None else None,
        t1_min=round(t1_min, 2) if t1_min is not None else None,
        t1_max=round(t1_max, 2) if t1_max is not None else None,
        hours_below_40=h_below or 0,
        hours_40_60=h_40_60 or 0,
        hours_60_75=h_60_75 or 0,
        hours_above_75=h_above or 0,
    )


@router.get("/points/{tu_uuid}/hourly", response_model=list[DeviceHourlyOut])
def point_hourly(
    tu_uuid: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(5000, le=20000),
    db: Session = Depends(get_device_db),
):
    q = db.query(DeviceHourly).filter(DeviceHourly.tu_uuid == tu_uuid)
    if date_from:
        q = q.filter(DeviceHourly.ts >= date_from)
    if date_to:
        q = q.filter(DeviceHourly.ts <= date_to)
    return q.order_by(DeviceHourly.ts).limit(limit).all()


@router.get("/uploads", response_model=list[DeviceUploadOut])
def list_uploads(db: Session = Depends(get_device_db)):
    return db.query(DeviceUpload).order_by(DeviceUpload.uploaded_at.desc()).all()


@router.get("/uploads/{upload_id}", response_model=DeviceUploadOut)
def get_upload(upload_id: int, db: Session = Depends(get_device_db)):
    up = db.query(DeviceUpload).get(upload_id)
    if up is None:
        raise HTTPException(404, "Загрузка не найдена")
    return up

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case, text, or_
from sqlalchemy.orm import Session

from app.device_database import get_device_db, device_engine
import json

from app.models import (
    DevicePoint, DeviceHourly, DeviceUpload, Outage, ObjectRegistry, Hierarchy,
)
from app.schemas.device_schemas import (
    DevicePointOut, DeviceHourlyOut, DevicePointSummary, DeviceUploadOut, OutageOut,
)
from app.services.address import normalize_address, is_matchable_address

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


@router.get("/points/{tu_uuid}/outages", response_model=list[OutageOut])
def point_outages(tu_uuid: str, db: Session = Depends(get_device_db)):
    """Отключения по адресу точки учёта (только затрагивающие ГВС)."""
    point = db.query(DevicePoint).filter(DevicePoint.tu_uuid == tu_uuid).first()
    if point is None or not point.object_name:
        return []
    addr = normalize_address(point.object_name)
    if not is_matchable_address(addr):
        return []
    return (
        db.query(Outage)
        .filter(Outage.address_norm == addr, Outage.service_gvs == True)  # noqa: E712
        .order_by(Outage.start_fact)
        .all()
    )


@router.get("/points/{tu_uuid}/hierarchy")
def point_hierarchy(tu_uuid: str, db: Session = Depends(get_device_db)):
    """Цепочка вышестоящих ТУ до источника; помечаем, у кого есть приборные данные."""
    h = db.query(Hierarchy).filter(Hierarchy.consumer_tu_id == tu_uuid).first()
    if h is None or not h.chain:
        return {"consumer_tu_id": tu_uuid, "chain": []}
    chain = json.loads(h.chain)
    ids = [n["tu_id"] for n in chain if n.get("tu_id")]
    with_data = set()
    if ids:
        rows = (
            db.query(DeviceHourly.tu_uuid)
            .filter(DeviceHourly.tu_uuid.in_(ids))
            .distinct()
            .all()
        )
        with_data = {r[0] for r in rows}
    for n in chain:
        n["has_data"] = n.get("tu_id") in with_data
    return {"consumer_tu_id": tu_uuid, "chain": chain}


@router.get("/objects/{object_id}/outages", response_model=list[OutageOut])
def object_outages(object_id: str, db: Session = Depends(get_device_db)):
    """Отключения ГВС по объекту: мост через реестр (ФИАС/адрес)."""
    reg = db.query(ObjectRegistry).filter(ObjectRegistry.object_id == object_id).first()
    conds = []
    if reg:
        if reg.fias:
            conds.append(Outage.fias == reg.fias)
        if reg.address_norm:
            conds.append(Outage.address_norm == reg.address_norm)
    if not conds:
        return []
    return (
        db.query(Outage)
        .filter(Outage.service_gvs == True, or_(*conds))  # noqa: E712
        .order_by(Outage.start_fact)
        .all()
    )


@router.get("/uploads", response_model=list[DeviceUploadOut])
def list_uploads(db: Session = Depends(get_device_db)):
    return db.query(DeviceUpload).order_by(DeviceUpload.uploaded_at.desc()).all()


@router.get("/uploads/{upload_id}", response_model=DeviceUploadOut)
def get_upload(upload_id: int, db: Session = Depends(get_device_db)):
    up = db.query(DeviceUpload).get(upload_id)
    if up is None:
        raise HTTPException(404, "Загрузка не найдена")
    return up


@router.delete("/data")
def clear_device_data(db: Session = Depends(get_device_db)):
    """Полностью очистить приборные данные (часы, точки, загрузки)."""
    hours = db.query(DeviceHourly).delete()
    db.query(DevicePoint).delete()
    db.query(Outage).delete()
    db.query(ObjectRegistry).delete()
    db.query(Hierarchy).delete()
    db.query(DeviceUpload).delete()
    db.commit()
    # Освобождаем место на диске после массового удаления.
    # VACUUM нельзя запускать внутри транзакции — отдельное autocommit-соединение.
    with device_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("VACUUM"))
    return {"status": "ok", "deleted_hours": hours}

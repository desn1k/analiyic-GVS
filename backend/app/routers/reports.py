import os
import shutil
import tempfile

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.device_database import get_device_db
from app.models import ReportPeriod, TuReportRow, DeviceUpload
from app.schemas.schemas import PeriodOut
from app.schemas.device_schemas import DeviceUploadOut
from app.services.ingest import ingest_report
from app.services.device_ingest import (
    looks_like_device_report, run_device_ingest_background,
)
from app.services.outage_ingest import (
    looks_like_outage_report, run_outage_ingest_background,
)
from app.services.registry_ingest import (
    looks_like_registry, run_registry_ingest_background,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/upload")
def upload_report(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    device_db: Session = Depends(get_device_db),
):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Ожидается файл Excel (.xlsx)")

    # Автоопределение формата. Приборные/ведомость (могут быть до ~1.5 ГБ) не
    # разбираем в самом запросе — иначе долгий парсинг упирается в таймауты
    # прокси (504/502). Сохраняем во временный файл и разбираем в фоне, а фронт
    # опрашивает статус.
    is_device = looks_like_device_report(file.file)
    is_outage = (not is_device) and looks_like_outage_report(file.file)
    is_registry = (not is_device and not is_outage) and looks_like_registry(file.file)
    if is_device or is_outage or is_registry:
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
        try:
            with os.fdopen(tmp_fd, "wb") as tmp:
                file.file.seek(0)
                shutil.copyfileobj(file.file, tmp, length=1024 * 1024)
        except Exception:
            os.remove(tmp_path)
            raise

        kind = "device" if is_device else ("outage" if is_outage else "registry")
        upload = DeviceUpload(source_filename=file.filename, kind=kind, status="processing")
        device_db.add(upload)
        device_db.commit()
        device_db.refresh(upload)

        runner = (
            run_device_ingest_background if is_device
            else run_outage_ingest_background if is_outage
            else run_registry_ingest_background
        )
        background.add_task(runner, tmp_path, upload.id)
        out = DeviceUploadOut.model_validate(upload)
        return {"kind": kind, "device": out.model_dump()}

    # Недельный аналитический отчёт — небольшой, разбираем сразу.
    try:
        period = ingest_report(db, file.file, file.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))

    tu_count = db.query(func.count(TuReportRow.id)).filter_by(period_id=period.id).scalar()
    out = PeriodOut.model_validate(period)
    out.tu_count = tu_count
    return {"kind": "report", "report": out.model_dump()}


@router.get("/periods", response_model=list[PeriodOut])
def list_periods(db: Session = Depends(get_db)):
    periods = db.query(ReportPeriod).order_by(ReportPeriod.period_start).all()
    result = []
    for p in periods:
        tu_count = db.query(func.count(TuReportRow.id)).filter_by(period_id=p.id).scalar()
        out = PeriodOut.model_validate(p)
        out.tu_count = tu_count
        result.append(out)
    return result


@router.delete("/periods/{period_id}")
def delete_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(ReportPeriod).get(period_id)
    if not period:
        raise HTTPException(404, "Период не найден")
    db.delete(period)
    db.commit()
    return {"status": "ok"}

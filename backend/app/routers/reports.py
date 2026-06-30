from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReportPeriod, TuReportRow
from app.schemas.schemas import PeriodOut
from app.services.ingest import ingest_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/upload", response_model=PeriodOut)
def upload_report(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Ожидается файл Excel (.xlsx)")
    try:
        period = ingest_report(db, file.file, file.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    tu_count = db.query(func.count(TuReportRow.id)).filter_by(period_id=period.id).scalar()
    out = PeriodOut.model_validate(period)
    out.tu_count = tu_count
    return out


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

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReportPeriod, TuReportRow
from app.schemas.schemas import TuRowOut, DynamicsPoint, FilterOptions

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _apply_filters(q, object_type, scheme, system_type, object_search):
    if object_type:
        q = q.filter(TuReportRow.object_type == object_type)
    if scheme:
        q = q.filter(TuReportRow.scheme == scheme)
    if system_type:
        q = q.filter(TuReportRow.system_type == system_type)
    if object_search:
        like = f"%{object_search}%"
        q = q.filter(TuReportRow.object_name.ilike(like))
    return q


def _to_out(row: TuReportRow) -> TuRowOut:
    out = TuRowOut.model_validate(row)
    violation = (row.volume_below_40 or 0) + (row.volume_40_60 or 0) + (row.volume_above_75 or 0)
    out.violation_volume = round(violation, 3)
    out.violation_pct = round(violation / row.volume_total * 100, 2) if row.volume_total else 0.0
    out.data_quality_pct = (
        round(row.valid_records / row.total_records * 100, 1) if row.total_records else 0.0
    )
    return out


@router.get("/periods/{period_id}/tu", response_model=list[TuRowOut])
def list_tu_rows(
    period_id: int,
    object_type: Optional[str] = None,
    scheme: Optional[str] = None,
    system_type: Optional[str] = None,
    search: Optional[str] = None,
    min_violation_pct: Optional[float] = None,
    sort_by: str = Query("violation_pct", pattern="^(violation_pct|volume_total|avg_temp_gvs|data_quality_pct)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = 500,
    db: Session = Depends(get_db),
):
    q = db.query(TuReportRow).filter(TuReportRow.period_id == period_id)
    q = _apply_filters(q, object_type, scheme, system_type, search)
    rows = [_to_out(r) for r in q.all()]

    if min_violation_pct is not None:
        rows = [r for r in rows if r.violation_pct >= min_violation_pct]

    rows.sort(key=lambda r: getattr(r, sort_by) or 0, reverse=(order == "desc"))
    return rows[:limit]


@router.get("/periods/{period_id}/filters", response_model=FilterOptions)
def get_filters(period_id: int, db: Session = Depends(get_db)):
    q = db.query(TuReportRow).filter(TuReportRow.period_id == period_id)
    object_types = sorted({r[0] for r in q.with_entities(TuReportRow.object_type) if r[0]})
    schemes = sorted({r[0] for r in q.with_entities(TuReportRow.scheme) if r[0]})
    system_types = sorted({r[0] for r in q.with_entities(TuReportRow.system_type) if r[0]})
    return FilterOptions(object_types=object_types, schemes=schemes, system_types=system_types)


@router.get("/dynamics", response_model=list[DynamicsPoint])
def get_dynamics(
    object_type: Optional[str] = None,
    scheme: Optional[str] = None,
    system_type: Optional[str] = None,
    object_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    periods = db.query(ReportPeriod).order_by(ReportPeriod.period_start).all()
    points = []
    for p in periods:
        q = db.query(TuReportRow).filter(TuReportRow.period_id == p.id)
        q = _apply_filters(q, object_type, scheme, system_type, None)
        if object_id:
            q = q.filter(TuReportRow.object_id == object_id)
        rows = q.all()
        if not rows:
            continue

        volume_total = sum(r.volume_total or 0 for r in rows)
        violation_volume = sum(
            (r.volume_below_40 or 0) + (r.volume_40_60 or 0) + (r.volume_above_75 or 0)
            for r in rows
        )
        temp_weighted = sum((r.avg_temp_gvs or 0) * (r.volume_total or 0) for r in rows)
        avg_temp = temp_weighted / volume_total if volume_total else 0.0

        points.append(DynamicsPoint(
            period_id=p.id,
            period_start=p.period_start,
            period_end=p.period_end,
            volume_total=round(volume_total, 2),
            violation_volume=round(violation_volume, 2),
            violation_pct=round(violation_volume / volume_total * 100, 2) if volume_total else 0.0,
            avg_temp_gvs=round(avg_temp, 2),
            hours_violation_low=sum(r.hours_violation_low or 0 for r in rows),
            hours_violation_high=sum(r.hours_violation_high or 0 for r in rows),
            tu_count=len(rows),
        ))
    return points

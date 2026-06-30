from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReportPeriod, TuReportRow
from app.schemas.schemas import (
    TuRowOut, DynamicsPoint, FilterOptions, WeeklySummary,
    ObjectComparisonOut, ObjectComparisonRow, ObjectPeriodMetric, PeriodOut,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _apply_filters(q, object_type, scheme, system_type, source_name, object_search):
    if object_type:
        q = q.filter(TuReportRow.object_type == object_type)
    if scheme:
        q = q.filter(TuReportRow.scheme == scheme)
    if system_type:
        q = q.filter(TuReportRow.system_type == system_type)
    if source_name:
        q = q.filter(TuReportRow.source_name == source_name)
    if object_search:
        like = f"%{object_search}%"
        q = q.filter(TuReportRow.object_name.ilike(like))
    return q


def _violation_volume(row: TuReportRow) -> float:
    return (row.volume_below_40 or 0) + (row.volume_40_60 or 0) + (row.volume_above_75 or 0)


def _data_quality_pct(row: TuReportRow) -> float:
    return round(row.valid_records / row.total_records * 100, 1) if row.total_records else 0.0


def _to_out(row: TuReportRow) -> TuRowOut:
    out = TuRowOut.model_validate(row)
    violation = _violation_volume(row)
    out.violation_volume = round(violation, 3)
    out.violation_pct = round(violation / row.volume_total * 100, 2) if row.volume_total else 0.0
    out.data_quality_pct = _data_quality_pct(row)
    return out


@router.get("/periods/{period_id}/tu", response_model=list[TuRowOut])
def list_tu_rows(
    period_id: int,
    object_type: Optional[str] = None,
    scheme: Optional[str] = None,
    system_type: Optional[str] = None,
    source_name: Optional[str] = None,
    search: Optional[str] = None,
    min_violation_pct: Optional[float] = None,
    min_data_quality_pct: Optional[float] = None,
    max_data_quality_pct: Optional[float] = None,
    sort_by: str = Query("violation_pct", pattern="^(violation_pct|volume_total|avg_temp_gvs|data_quality_pct)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = 2000,
    db: Session = Depends(get_db),
):
    q = db.query(TuReportRow).filter(TuReportRow.period_id == period_id)
    q = _apply_filters(q, object_type, scheme, system_type, source_name, search)
    rows = [_to_out(r) for r in q.all()]

    if min_violation_pct is not None:
        rows = [r for r in rows if r.violation_pct >= min_violation_pct]
    if min_data_quality_pct is not None:
        rows = [r for r in rows if r.data_quality_pct >= min_data_quality_pct]
    if max_data_quality_pct is not None:
        rows = [r for r in rows if r.data_quality_pct <= max_data_quality_pct]

    rows.sort(key=lambda r: getattr(r, sort_by) or 0, reverse=(order == "desc"))
    return rows[:limit]


@router.get("/periods/{period_id}/filters", response_model=FilterOptions)
def get_filters(period_id: int, db: Session = Depends(get_db)):
    q = db.query(TuReportRow).filter(TuReportRow.period_id == period_id)
    object_types = sorted({r[0] for r in q.with_entities(TuReportRow.object_type) if r[0]})
    schemes = sorted({r[0] for r in q.with_entities(TuReportRow.scheme) if r[0]})
    system_types = sorted({r[0] for r in q.with_entities(TuReportRow.system_type) if r[0]})
    sources = sorted({r[0] for r in q.with_entities(TuReportRow.source_name) if r[0]})
    return FilterOptions(
        object_types=object_types, schemes=schemes, system_types=system_types, sources=sources,
    )


@router.get("/dynamics", response_model=list[DynamicsPoint])
def get_dynamics(
    object_type: Optional[str] = None,
    scheme: Optional[str] = None,
    system_type: Optional[str] = None,
    source_name: Optional[str] = None,
    object_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    periods = db.query(ReportPeriod).order_by(ReportPeriod.period_start).all()
    points = []
    for p in periods:
        q = db.query(TuReportRow).filter(TuReportRow.period_id == p.id)
        q = _apply_filters(q, object_type, scheme, system_type, source_name, None)
        if object_id:
            q = q.filter(TuReportRow.object_id == object_id)
        rows = q.all()
        if not rows:
            continue

        volume_total = sum(r.volume_total or 0 for r in rows)
        violation_volume = sum(_violation_volume(r) for r in rows)
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


@router.get("/weekly-summary", response_model=list[WeeklySummary])
def get_weekly_summary(
    object_type: Optional[str] = None,
    scheme: Optional[str] = None,
    system_type: Optional[str] = None,
    source_name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Сводка по неделям: объекты агрегируются (несколько ТУ на объект суммируются)."""
    periods = db.query(ReportPeriod).order_by(ReportPeriod.period_start).all()
    result = []
    for p in periods:
        q = db.query(TuReportRow).filter(TuReportRow.period_id == p.id)
        q = _apply_filters(q, object_type, scheme, system_type, source_name, None)
        rows = q.all()
        if not rows:
            continue

        by_object: dict[str, dict] = {}
        for r in rows:
            agg = by_object.setdefault(r.object_id, {"volume_total": 0.0, "violation_volume": 0.0, "above_75": 0.0})
            agg["volume_total"] += r.volume_total or 0
            agg["violation_volume"] += _violation_volume(r)
            agg["above_75"] += r.volume_above_75 or 0

        volume_total = sum(o["volume_total"] for o in by_object.values())
        violation_volume = sum(o["violation_volume"] for o in by_object.values())
        objects_with_violation = sum(1 for o in by_object.values() if o["violation_volume"] > 0)
        overheat_count = sum(1 for o in by_object.values() if o["above_75"] > 0)

        result.append(WeeklySummary(
            period_id=p.id,
            period_start=p.period_start,
            period_end=p.period_end,
            objects_count=len(by_object),
            tu_count=len(rows),
            objects_with_violation=objects_with_violation,
            volume_total=round(volume_total, 2),
            violation_volume=round(violation_volume, 2),
            violation_pct=round(violation_volume / volume_total * 100, 2) if volume_total else 0.0,
            overheat_count=overheat_count,
        ))
    return result


@router.get("/object-comparison", response_model=ObjectComparisonOut)
def get_object_comparison(
    object_type: Optional[str] = None,
    scheme: Optional[str] = None,
    system_type: Optional[str] = None,
    source_name: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Сравнение объектов по неделям: одна строка на объект, столбцы — периоды."""
    periods = db.query(ReportPeriod).order_by(ReportPeriod.period_start).all()
    objects: dict[str, ObjectComparisonRow] = {}

    for p in periods:
        q = db.query(TuReportRow).filter(TuReportRow.period_id == p.id)
        q = _apply_filters(q, object_type, scheme, system_type, source_name, search)
        rows = q.all()

        by_object: dict[str, dict] = {}
        for r in rows:
            agg = by_object.setdefault(r.object_id, {
                "object_name": r.object_name, "object_type": r.object_type,
                "volume_total": 0.0, "violation_volume": 0.0, "above_75": 0.0,
                "temp_weighted": 0.0,
            })
            agg["volume_total"] += r.volume_total or 0
            agg["violation_volume"] += _violation_volume(r)
            agg["above_75"] += r.volume_above_75 or 0
            agg["temp_weighted"] += (r.avg_temp_gvs or 0) * (r.volume_total or 0)

        for object_id, agg in by_object.items():
            row = objects.get(object_id)
            if row is None:
                row = ObjectComparisonRow(
                    object_id=object_id,
                    object_name=agg["object_name"],
                    object_type=agg["object_type"],
                    periods={},
                )
                objects[object_id] = row

            vt = agg["volume_total"]
            row.periods[p.id] = ObjectPeriodMetric(
                period_id=p.id,
                volume_total=round(vt, 2),
                violation_volume=round(agg["violation_volume"], 2),
                violation_pct=round(agg["violation_volume"] / vt * 100, 2) if vt else 0.0,
                avg_temp_gvs=round(agg["temp_weighted"] / vt, 2) if vt else 0.0,
                has_overheat=agg["above_75"] > 0,
            )

    period_counts = {}
    for p in periods:
        tu_count = (
            db.query(TuReportRow)
            .filter(TuReportRow.period_id == p.id)
            .count()
        )
        period_counts[p.id] = tu_count

    return ObjectComparisonOut(
        periods=[
            PeriodOut(
                id=p.id, period_start=p.period_start, period_end=p.period_end,
                generated_at=p.generated_at, source_filename=p.source_filename,
                tu_count=period_counts[p.id],
            )
            for p in periods
        ],
        objects=list(objects.values()),
    )

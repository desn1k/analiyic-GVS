from sqlalchemy.orm import Session

from app.models import ReportPeriod, TuReportRow
from app.services.report_parser import extract_city, parse_report

ANALYZED_CITY = "Саратов"


def _normalize_yes_no(v):
    if not v:
        return None
    s = str(v).strip().lower()
    if s in ("да", "нет"):
        return s
    return None


def _normalize_system_type(v):
    if not v:
        return None
    s = str(v).strip().lower()
    if s == "открытая":
        return "Открытая"
    if s == "закрытая":
        return "Закрытая"
    return str(v).strip()


def ingest_report(db: Session, file, filename: str) -> ReportPeriod:
    period_start, period_end, generated_at, rows = parse_report(file)
    rows = [r for r in rows if extract_city(r["object_name"]) == ANALYZED_CITY]

    # Дедуп по периоду (без учёта имени файла): один и тот же период,
    # загруженный под другим именем, заменяет предыдущий, а не дублирует.
    existing = (
        db.query(ReportPeriod)
        .filter_by(period_start=period_start, period_end=period_end)
        .all()
    )
    for e in existing:
        db.delete(e)
    if existing:
        db.flush()

    period = ReportPeriod(
        period_start=period_start,
        period_end=period_end,
        generated_at=generated_at,
        source_filename=filename,
    )
    db.add(period)
    db.flush()

    for r in rows:
        db.add(TuReportRow(
            period_id=period.id,
            object_name=r["object_name"],
            tu_name=r["tu_name"],
            object_id=r["object_id"],
            object_type=r["object_type"],
            tu_id=r["tu_id"],
            source_name=r["source_name"],
            avg_temp_ctp=r["avg_temp_ctp"],
            is_dead_end=_normalize_yes_no(r["is_dead_end"]),
            system_type=_normalize_system_type(r["system_type"]),
            total_records=r["total_records"],
            valid_records=r["valid_records"],
            avg_temp_gvs=r["avg_temp_gvs"],
            contract_load=r["contract_load"],
            volume_total=r["volume_total"],
            volume_below_40=r["volume_below_40"],
            volume_40_60=r["volume_40_60"],
            volume_60_75=r["volume_60_75"],
            volume_above_75=r["volume_above_75"],
            hours_total=r["hours_total"],
            hours_violation_low=r["hours_violation_low"],
            hours_violation_high=r["hours_violation_high"],
            flow_below_2pct=r["flow_below_2pct"],
            check_no_data=r["check_no_data"],
            check_vnr=r["check_vnr"],
            check_m1_m2=r["check_m1_m2"],
            check_qinj=r["check_qinj"],
            check_t_range=r["check_t_range"],
            check_t1_lt_t2=r["check_t1_lt_t2"],
            check_v_max=r["check_v_max"],
            check_t1_const=r["check_t1_const"],
            check_t_other=r["check_t_other"],
            scheme=r["scheme"],
        ))

    db.commit()
    db.refresh(period)
    return period

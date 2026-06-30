"""Парсер отчёта "Количество случаев нарушения качества ГВС (подробный)"."""
import re
from datetime import datetime, date
from typing import BinaryIO

import openpyxl

TITLE_RE = re.compile(r"за\s+(\d{2}\.\d{2}\.\d{2,4})\s*-\s*(\d{2}\.\d{2}\.\d{2,4})")
GENERATED_RE = re.compile(r"(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})")
CITY_RE = re.compile(r"(?:^|,)\s*([А-Яа-яЁё\-]+(?:\s[А-Яа-яЁё\-]+)*)\s+г(?:\s*[,(]|$)")


def extract_city(object_name: str) -> str | None:
    """Эвристика: ищет сегмент вида '<Город> г' в адресе объекта,
    пропуская сегменты вида '<Область> обл'."""
    if not object_name:
        return None
    for m in CITY_RE.finditer(object_name):
        name = m.group(1).strip()
        if "обл" not in name:
            return name
    first = object_name.split(",")[0].strip()
    return first or None

# Позиции колонок (0-based) в строке данных, начиная со строки 5.
COLUMNS = [
    ("seq", 0),
    ("object_name", 1),
    ("tu_name", 2),
    ("object_id", 3),
    ("object_type", 4),
    ("tu_id", 6),
    ("source_name", 7),
    ("avg_temp_ctp", 8),
    ("is_dead_end", 9),
    ("system_type", 10),
    ("total_records", 11),
    ("valid_records", 13),
    ("avg_temp_gvs", 14),
    ("contract_load", 15),
    ("volume_total", 16),
    ("volume_below_40", 17),
    ("volume_40_60", 18),
    ("volume_60_75", 19),
    ("volume_above_75", 20),
    ("hours_total", 21),
    ("hours_violation_low", 22),
    ("hours_violation_high", 23),
    ("flow_below_2pct", 24),
    ("check_no_data", 25),
    ("check_vnr", 26),
    ("check_m1_m2", 27),
    ("check_qinj", 28),
    ("check_t_range", 29),
    ("check_t1_lt_t2", 30),
    ("check_v_max", 31),
    ("check_t1_const", 32),
    ("check_t_other", 33),
    ("scheme", 34),
]

INT_FIELDS = {
    "total_records", "valid_records", "hours_total",
    "hours_violation_low", "hours_violation_high", "flow_below_2pct",
    "check_no_data", "check_vnr", "check_m1_m2", "check_qinj",
    "check_t_range", "check_t1_lt_t2", "check_v_max", "check_t1_const",
    "check_t_other",
}
FLOAT_FIELDS = {
    "avg_temp_ctp", "avg_temp_gvs", "contract_load", "volume_total",
    "volume_below_40", "volume_40_60", "volume_60_75", "volume_above_75",
}


def _parse_date(s: str) -> date:
    s = s.strip()
    fmt = "%d.%m.%Y" if len(s.split(".")[-1]) == 4 else "%d.%m.%y"
    return datetime.strptime(s, fmt).date()


def _to_int(v):
    if v in (None, ""):
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _to_float(v):
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def parse_report(file: BinaryIO):
    """Возвращает (period_start, period_end, generated_at, rows)."""
    wb = openpyxl.load_workbook(file, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]

    rows_iter = ws.iter_rows(values_only=True)
    title_row = next(rows_iter)
    title_cell = next((c for c in title_row if isinstance(c, str) and "за" in c), None)
    if not title_cell:
        raise ValueError("Не найден заголовок с периодом отчёта")
    m = TITLE_RE.search(title_cell)
    if not m:
        raise ValueError(f"Не удалось распознать период в заголовке: {title_cell!r}")
    period_start = _parse_date(m.group(1))
    period_end = _parse_date(m.group(2))

    gen_row = next(rows_iter)
    gen_cell = next((c for c in gen_row if isinstance(c, str) and "формирования" in c), None)
    generated_at = None
    if gen_cell:
        gm = GENERATED_RE.search(gen_cell)
        if gm:
            generated_at = datetime.strptime(f"{gm.group(1)} {gm.group(2)}", "%d.%m.%Y %H:%M:%S")

    next(rows_iter)  # строка заголовков (верхняя)
    next(rows_iter)  # строка заголовков (нижняя, подзаголовки проверок)

    rows = []
    for raw in rows_iter:
        if raw is None or all(v is None for v in raw):
            continue
        if raw[0] is None or raw[1] is None:
            continue
        row = {}
        for name, idx in COLUMNS:
            val = raw[idx] if idx < len(raw) else None
            if name in INT_FIELDS:
                val = _to_int(val)
            elif name in FLOAT_FIELDS:
                val = _to_float(val)
            elif isinstance(val, str):
                val = val.strip()
            row[name] = val
        rows.append(row)

    return period_start, period_end, generated_at, rows

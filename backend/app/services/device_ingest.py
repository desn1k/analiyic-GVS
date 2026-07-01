"""Потоковый импорт почасовых данных с приборов учёта.

Формат отчёта («Отчет о часовых параметрах») — вертикальные блоки по одной
точке учёта. Каждый блок:
    Объект: ...
    Прибор: ...
    Точка измерения: ...; Ресурс: ...   <- в столбце GE (187) стоит UUID ТУ
    Схема измерений: ...
    Дата | t1 | t2 | ...                 <- строка заголовков
    (единицы)
    <почасовые строки>
    (мини-таблица итоговых показаний счётчика)

Файлы бывают до 1.5 ГБ, поэтому читаем строго потоково (openpyxl read_only,
строка за строкой) и пишем сырые часы пачками через bulk insert — память
не зависит от размера файла.
"""
import re
from datetime import datetime
from typing import Optional

import openpyxl
from sqlalchemy.orm import Session

from app.models import DeviceUpload, DevicePoint, DeviceHourly

# «Якорные» столбцы (1-based индексы), только они несут значения —
# остальные это растянутые объединённые ячейки заголовков.
COL_DATE = 1
COL_GE = 187  # UUID точки учёта (в строке «Точка измерения»)
PARAM_COLS = {
    "t1": 2, "t2": 7, "t3": 18, "t4": 29, "t5": 41,
    "m1": 54, "m2": 67, "m3": 81, "m4": 94,
    "p1": 107, "p2": 118, "p3": 129, "p4": 140,
    "q1": 154, "q2": 168, "q3": 183, "q4": 195,
    "ns": 204,
}

BATCH_SIZE = 5000
_TS_FORMATS = ("%d.%m.%Y %H:%M", "%d.%m.%Y %H:%M:%S")

_TITLE_RE = re.compile(r"Отчет о часовых параметрах")


def looks_like_device_report(file_obj) -> bool:
    """Быстрая проверка формата по первым ячейкам, без полного разбора."""
    try:
        file_obj.seek(0)
        wb = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        for i, row in enumerate(ws.iter_rows(min_row=1, max_row=4, values_only=True), 1):
            if row and isinstance(row[0], str) and _TITLE_RE.search(row[0]):
                wb.close()
                return True
            if i >= 4:
                break
        wb.close()
    except Exception:
        return False
    finally:
        file_obj.seek(0)
    return False


def _num(v) -> Optional[float]:
    if v is None or v == "" or v == "---":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return None


def _parse_ts(v) -> Optional[datetime]:
    if isinstance(v, datetime):
        return v
    if not isinstance(v, str):
        return None
    s = v.strip()
    for fmt in _TS_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _strip_prefix(s: str, prefix: str) -> str:
    return s[len(prefix):].strip() if s.startswith(prefix) else s.strip()


def ingest_device_report(db: Session, source, upload_id: int) -> DeviceUpload:
    """Разбирает файл потоково и складывает сырые часы в device.db.

    source — путь к файлу или файловый объект. upload_id — заранее созданная
    строка DeviceUpload (в фоне обновляем её прогресс и статус).
    Коммитим порциями, чтобы память/размер транзакции не зависели от файла.
    """
    if hasattr(source, "seek"):
        source.seek(0)
    wb = openpyxl.load_workbook(source, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]

    upload = db.query(DeviceUpload).get(upload_id)

    cur_object = None
    cur_device = None
    cur_tu_name = None
    cur_resource = None
    cur_scheme = None
    cur_uuid = None
    in_data = False  # мы внутри почасовой таблицы

    points: dict[str, dict] = {}
    batch: list[dict] = []
    hours_count = 0
    min_ts: Optional[datetime] = None
    max_ts: Optional[datetime] = None
    param_items = list(PARAM_COLS.items())

    flushes_since_commit = 0

    def flush_batch(final=False):
        nonlocal batch, flushes_since_commit
        if batch:
            db.bulk_insert_mappings(DeviceHourly, batch)
            batch = []
            flushes_since_commit += 1
        # Коммитим каждые ~20 пачек (≈100k строк) и обновляем прогресс,
        # чтобы транзакция и WAL не разрастались на огромных файлах.
        if final or flushes_since_commit >= 20:
            upload.hours_count = hours_count
            upload.points_count = len(points)
            db.commit()
            flushes_since_commit = 0

    for row in ws.iter_rows(values_only=True):
        a = row[0]
        if isinstance(a, str):
            head = a.strip()
            if head.startswith("Объект:"):
                cur_object = _strip_prefix(head, "Объект:")
                in_data = False
                continue
            if head.startswith("Прибор:"):
                cur_device = _strip_prefix(head, "Прибор:")
                in_data = False
                continue
            if head.startswith("Точка измерения:"):
                body = _strip_prefix(head, "Точка измерения:")
                resource = None
                if "; Ресурс:" in body:
                    body, resource = body.split("; Ресурс:", 1)
                    resource = resource.strip()
                cur_tu_name = body.strip()
                cur_resource = resource
                ge = row[COL_GE - 1] if len(row) >= COL_GE else None
                cur_uuid = str(ge).strip() if ge not in (None, "") else None
                in_data = False
                continue
            if head.startswith("Схема измерений:"):
                cur_scheme = _strip_prefix(head, "Схема измерений:")
                in_data = False
                continue
            if head == "Дата":
                # Строка заголовков. Настоящая почасовая таблица имеет 't1' в
                # столбце B; под-таблица итоговых показаний счётчика — 'M1',
                # её пропускаем (значения там нарастающим итогом, не по часам).
                t1_hdr = row[PARAM_COLS["t1"] - 1] if len(row) >= PARAM_COLS["t1"] else None
                in_data = (t1_hdr == "t1")
                continue
            if _TITLE_RE.search(head):
                in_data = False
                continue

        if not in_data or cur_uuid is None:
            continue

        ts = _parse_ts(a)
        if ts is None:
            # строка единиц измерения или итоговая под-таблица — пропускаем
            continue

        rec = {"tu_uuid": cur_uuid, "upload_id": upload_id, "ts": ts}
        valid = True
        for name, col in param_items:
            raw = row[col - 1] if len(row) >= col else None
            if raw == "---":
                valid = False
            rec[name] = _num(raw)
        if rec.get("t1") is None:
            valid = False
        rec["valid"] = valid
        batch.append(rec)
        hours_count += 1

        if min_ts is None or ts < min_ts:
            min_ts = ts
        if max_ts is None or ts > max_ts:
            max_ts = ts

        p = points.get(cur_uuid)
        if p is None:
            points[cur_uuid] = {
                "object_name": cur_object, "device_name": cur_device,
                "tu_name": cur_tu_name, "resource": cur_resource, "scheme": cur_scheme,
            }

        if len(batch) >= BATCH_SIZE:
            flush_batch()

    flush_batch(final=True)
    wb.close()

    # upsert точек учёта (мета)
    for uuid, meta in points.items():
        existing = db.query(DevicePoint).filter(DevicePoint.tu_uuid == uuid).first()
        if existing is None:
            db.add(DevicePoint(
                tu_uuid=uuid, last_upload_id=upload_id, **meta,
            ))
        else:
            for k, v in meta.items():
                setattr(existing, k, v)
            existing.last_upload_id = upload_id

    upload.period_start = min_ts
    upload.period_end = max_ts
    upload.points_count = len(points)
    upload.hours_count = hours_count
    upload.status = "done"
    db.commit()
    return upload


def run_device_ingest_background(path: str, upload_id: int):
    """Фоновый разбор: своя сессia БД, удаляет временный файл, ловит ошибки."""
    import os
    from app.device_database import DeviceSessionLocal

    db = DeviceSessionLocal()
    try:
        ingest_device_report(db, path, upload_id)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        up = db.query(DeviceUpload).get(upload_id)
        if up is not None:
            up.status = "error"
            up.error = str(e)[:500]
            db.commit()
    finally:
        db.close()
        try:
            os.remove(path)
        except OSError:
            pass

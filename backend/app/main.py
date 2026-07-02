import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.device_database import DeviceBase, device_engine
from app.routers import reports, analytics, device, dashboard

Base.metadata.create_all(bind=engine)
DeviceBase.metadata.create_all(bind=device_engine)


def _ensure_device_columns():
    """Лёгкая миграция: столбцы + уникальные индексы (дедуп) в существующей device.db."""
    from sqlalchemy import inspect, text

    insp = inspect(device_engine)
    tables = insp.get_table_names()
    if "device_uploads" not in tables:
        return
    existing = {c["name"] for c in insp.get_columns("device_uploads")}
    with device_engine.begin() as conn:
        if "status" not in existing:
            conn.execute(text("ALTER TABLE device_uploads ADD COLUMN status VARCHAR DEFAULT 'done'"))
        if "error" not in existing:
            conn.execute(text("ALTER TABLE device_uploads ADD COLUMN error VARCHAR"))
        if "kind" not in existing:
            conn.execute(text("ALTER TABLE device_uploads ADD COLUMN kind VARCHAR DEFAULT 'device'"))

        if "device_hourly" in tables:
            hcols = {c["name"] for c in insp.get_columns("device_hourly")}
            if "v1" not in hcols:
                conn.execute(text("ALTER TABLE device_hourly ADD COLUMN v1 FLOAT"))
            if "v2" not in hcols:
                conn.execute(text("ALTER TABLE device_hourly ADD COLUMN v2 FLOAT"))

        # Уникальные индексы для дедупа при повторной загрузке. Перед созданием
        # убираем уже накопленные дубли (оставляем строку с максимальным id).
    def _index_exists(conn, name):
        return conn.execute(text(
            "SELECT 1 FROM sqlite_master WHERE type='index' AND name=:n"
        ), {"n": name}).first() is not None

    with device_engine.begin() as conn:
        if "device_hourly" in tables and not _index_exists(conn, "uq_device_hourly_tu_ts"):
            conn.execute(text(
                "DELETE FROM device_hourly WHERE id NOT IN "
                "(SELECT MAX(id) FROM device_hourly GROUP BY tu_uuid, ts)"
            ))
            conn.execute(text(
                "CREATE UNIQUE INDEX uq_device_hourly_tu_ts ON device_hourly(tu_uuid, ts)"
            ))
        if "outages" in tables and not _index_exists(conn, "uq_outage_key"):
                # COALESCE — иначе строки с NULL (напр. без даты) считаются
                # уникальными и дублируются при повторной загрузке.
                key = ("COALESCE(number,''), address_norm, "
                       "COALESCE(start_fact,''), COALESCE(impact,'')")
                conn.execute(text(
                    f"DELETE FROM outages WHERE id NOT IN "
                    f"(SELECT MAX(id) FROM outages GROUP BY {key})"
                ))
                conn.execute(text(
                    f"CREATE UNIQUE INDEX uq_outage_key ON outages({key})"
                ))


_ensure_device_columns()

app = FastAPI(title="ГВС Аналитика")

# In production the frontend is served by nginx on the same origin and
# proxies /api/* to this service, so no cross-origin requests happen and
# CORS_ORIGINS can stay unset. Set it (comma-separated) only if the
# frontend is hosted on a different origin.
cors_origins = os.environ.get("CORS_ORIGINS", "")
allow_origins = [o.strip() for o in cors_origins.split(",") if o.strip()] or ["http://127.0.0.1:5173", "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(device.router)
app.include_router(dashboard.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}

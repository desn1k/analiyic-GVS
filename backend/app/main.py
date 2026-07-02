import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.device_database import DeviceBase, device_engine
from app.routers import reports, analytics, device, dashboard

Base.metadata.create_all(bind=engine)
DeviceBase.metadata.create_all(bind=device_engine)


def _ensure_device_columns():
    """Лёгкая миграция: добавляем недостающие столбцы в существующую device.db."""
    from sqlalchemy import inspect, text

    insp = inspect(device_engine)
    if "device_uploads" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("device_uploads")}
    with device_engine.begin() as conn:
        if "status" not in existing:
            conn.execute(text("ALTER TABLE device_uploads ADD COLUMN status VARCHAR DEFAULT 'done'"))
        if "error" not in existing:
            conn.execute(text("ALTER TABLE device_uploads ADD COLUMN error VARCHAR"))
        if "kind" not in existing:
            conn.execute(text("ALTER TABLE device_uploads ADD COLUMN kind VARCHAR DEFAULT 'device'"))


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

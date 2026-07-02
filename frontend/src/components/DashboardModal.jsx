import { useEffect, useState } from "react";
import { getDashboard, clearDeviceData } from "../api/client";
import { formatPeriod } from "../utils/format";

function num(v) {
  return v === null || v === undefined ? "—" : Number(v).toLocaleString("ru-RU");
}

function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardModal({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = () => {
    setLoading(true);
    getDashboard().then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    if (!window.confirm("Удалить ВСЕ приборные почасовые данные? Недельные отчёты не затрагиваются.")) return;
    setClearing(true);
    try {
      await clearDeviceData();
      load();
    } finally {
      setClearing(false);
    }
  };

  const r = data?.report;
  const d = data?.device;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Дашборд</h3>
            <div className="modal-sub">Сводка по загруженным данным</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && <p className="empty-hint">Загрузка…</p>}

          {!loading && data && (
            <>
              <h4 className="dash-section">Приборные данные (почасовые)</h4>
              <div className="device-stats">
                <Stat label="Точек учёта" value={num(d.points_total)} />
                <Stat label="Загрузок файлов" value={num(d.uploads_total)} />
                <Stat label="Часов всего" value={num(d.hours_total)} />
                <Stat label="Достоверных часов" value={`${num(d.hours_valid)} (${d.valid_pct}%)`} ok />
                <Stat label="Пустые / недостоверные часы" value={num(d.hours_invalid)} danger={d.hours_invalid > 0} />
                <Stat label="Часов без T подачи" value={num(d.hours_no_t1)} danger={d.hours_no_t1 > 0} />
                <Stat label="Точек без данных" value={num(d.points_without_valid)} danger={d.points_without_valid > 0} />
                <Stat label="Отключений ГВС" value={num(d.outages_gvs)} />
                <Stat label="Паспортов (реестр)" value={num(d.registry_total)} />
                <Stat label="Диапазон" value={d.ts_min ? `${fmtDateTime(d.ts_min)} — ${fmtDateTime(d.ts_max)}` : "—"} />
              </div>

              {d.points_no_data?.length > 0 && (
                <PointsList
                  title={`Точки без данных вообще (${d.points_no_data.length})`}
                  points={d.points_no_data}
                  kind="no-data"
                />
              )}
              {d.points_partial?.length > 0 && (
                <PointsList
                  title={`Точки с пустыми (недостоверными) данными (${d.points_partial.length})`}
                  points={d.points_partial}
                  kind="partial"
                />
              )}

              {d.uploads?.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 12, maxHeight: 220 }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Файл</th>
                        <th>Период</th>
                        <th>Точек</th>
                        <th>Часов</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.uploads.map((u) => (
                        <tr key={u.id}>
                          <td className="wrap-cell" style={{ textAlign: "left" }} title={u.source_filename}>{u.source_filename}</td>
                          <td>{u.period_start ? formatPeriod(u.period_start, u.period_end) : "—"}</td>
                          <td>{num(u.points_count)}</td>
                          <td>{num(u.hours_count)}</td>
                          <td className={u.status === "error" ? "violation" : ""}>{statusLabel(u.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 className="dash-section">Недельные отчёты качества ГВС</h4>
              <div className="device-stats">
                <Stat label="Периодов (недель)" value={num(r.periods_total)} />
                <Stat label="Объектов" value={num(r.objects_total)} />
                <Stat label="Строк ТУ" value={num(r.tu_rows_total)} />
                <Stat label="Диапазон" value={r.period_start ? formatPeriod(r.period_start, r.period_end) : "—"} />
              </div>

              <div className="dash-actions">
                <button type="button" className="danger-btn" onClick={handleClear} disabled={clearing}>
                  {clearing ? "Удаление…" : "Очистить приборные данные"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PointsList({ title, points, kind }) {
  return (
    <>
      <h4 className="dash-section">{title}</h4>
      <div className="table-wrap" style={{ maxHeight: 240 }}>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Объект</th>
              <th>Часов всего</th>
              {kind === "partial" && <th>Пустых</th>}
              {kind === "partial" && <th>% пустых</th>}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.tu_uuid}>
                <td className="wrap-cell" style={{ textAlign: "left" }} title={p.object_name}>
                  {p.object_name || p.tu_uuid}
                </td>
                <td>{num(p.hours_total)}</td>
                {kind === "partial" && <td>{num(p.hours_invalid)}</td>}
                {kind === "partial" && <td className="violation">{p.invalid_pct}%</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function statusLabel(s) {
  if (s === "processing") return "обработка…";
  if (s === "error") return "ошибка";
  return "готово";
}

function Stat({ label, value, danger, ok }) {
  return (
    <div className="device-stat">
      <div className="device-stat-label">{label}</div>
      <div className={`device-stat-value${danger ? " danger" : ""}${ok ? " ok" : ""}`}>{value}</div>
    </div>
  );
}

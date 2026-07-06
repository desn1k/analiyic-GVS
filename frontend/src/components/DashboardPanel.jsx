import { clearDeviceData } from "../api/client";
import { formatPeriod } from "../utils/format";
import { useState } from "react";

function num(v) {
  return v === null || v === undefined ? "—" : Number(v).toLocaleString("ru-RU");
}
function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Панель со статистикой по загруженным данным (без модального окна).
export default function DashboardPanel({ data, onReload }) {
  const [clearing, setClearing] = useState(false);
  if (!data) return <p className="empty-hint">Загрузка…</p>;
  const r = data.report;
  const d = data.device;

  const handleClear = async () => {
    if (!window.confirm("Удалить ВСЕ приборные данные (часы, точки, отключения, реестр, иерархию)? Недельные отчёты не затрагиваются.")) return;
    setClearing(true);
    try { await clearDeviceData(); onReload?.(); }
    finally { setClearing(false); }
  };

  return (
    <>
      <h4 className="dash-section">Приборные данные (почасовые)</h4>
      <div className="device-stats">
        <Stat label="Точек учёта" value={num(d.points_total)} />
        <Stat label="Часов всего" value={num(d.hours_total)} />
        <Stat label="Достоверных часов" value={`${num(d.hours_valid)} (${d.valid_pct}%)`} ok />
        <Stat label="Пустые / недостоверные" value={num(d.hours_invalid)} danger={d.hours_invalid > 0} />
        <Stat label="Точек без данных" value={num(d.points_without_valid)} danger={d.points_without_valid > 0} />
        <Stat label="Отключений ГВС" value={num(d.outages_gvs)} />
        <Stat label="Паспортов (реестр)" value={num(d.registry_total)} />
        {d.hierarchy_total > 0 && (
          <Stat label="Точек иерархии без данных" value={`${num(d.hierarchy_no_data_count)} из ${num(d.hierarchy_total)}`} danger={d.hierarchy_no_data_count > 0} />
        )}
        <Stat label="Диапазон данных" value={d.ts_min ? `${fmtDateTime(d.ts_min)} — ${fmtDateTime(d.ts_max)}` : "—"} />
      </div>

      {d.points_no_data?.length > 0 && (
        <PointsList title={`Точки без данных вообще (${d.points_no_data.length})`} points={d.points_no_data} kind="no-data" />
      )}
      {d.points_partial?.length > 0 && (
        <PointsList title={`Точки с пустыми (недостоверными) данными (${d.points_partial.length})`} points={d.points_partial} kind="partial" />
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
                <td className="wrap-cell" style={{ textAlign: "left" }} title={p.object_name}>{p.object_name || p.tu_uuid}</td>
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

function Stat({ label, value, danger, ok }) {
  return (
    <div className="device-stat">
      <div className="device-stat-label">{label}</div>
      <div className={`device-stat-value${danger ? " danger" : ""}${ok ? " ok" : ""}`}>{value}</div>
    </div>
  );
}

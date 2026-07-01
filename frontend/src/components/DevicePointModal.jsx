import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ReferenceArea,
} from "recharts";
import { getDeviceSummary, getDeviceHourly } from "../api/client";

function fmtTs(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
}

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

export default function DevicePointModal({ row, onClose }) {
  const [summary, setSummary] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const tuUuid = row?.tu_id;

  useEffect(() => {
    if (!tuUuid) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([getDeviceSummary(tuUuid), getDeviceHourly(tuUuid, { limit: 20000 })])
      .then(([s, h]) => {
        if (!alive) return;
        setSummary(s);
        setHourly(h);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.response?.status === 404 ? "notfound" : (e.message || "Ошибка"));
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [tuUuid]);

  const hasData = summary && summary.hours_total > 0;
  const chartData = (hourly || []).map((h) => ({
    ts: fmtTs(h.ts),
    "T подачи (t1)": h.valid ? h.t1 : null,
    "T обратки (t2)": h.valid ? h.t2 : null,
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{row?.object_name}</h3>
            <div className="modal-sub">{row?.tu_name || "ТУ"} · приборные (почасовые) данные</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && <p className="empty-hint">Загрузка приборных данных…</p>}

          {!loading && (error || !hasData) && (
            <p className="empty-hint">
              По этой точке учёта нет приборных данных в базе.<br />
              Загрузите почасовой отчёт с прибора (файл «Отчёт о часовых параметрах»).
            </p>
          )}

          {!loading && hasData && (
            <>
              <div className="device-stats">
                <Stat label="Часов всего" value={summary.hours_total} />
                <Stat label="Достоверных" value={`${summary.hours_valid} (${fmtNum(summary.valid_pct)}%)`} />
                <Stat label="Сред. T подачи" value={`${fmtNum(summary.t1_avg)} °C`} />
                <Stat label="Мин / Макс T" value={`${fmtNum(summary.t1_min)} / ${fmtNum(summary.t1_max)} °C`} />
                <Stat label="Часов < 40°C" value={summary.hours_below_40} danger={summary.hours_below_40 > 0} />
                <Stat label="Часов 40–60°C" value={summary.hours_40_60} danger={summary.hours_40_60 > 0} />
                <Stat label="Часов 60–75°C (норма)" value={summary.hours_60_75} ok />
                <Stat label="Часов > 75°C" value={summary.hours_above_75} danger={summary.hours_above_75 > 0} />
              </div>

              <div style={{ marginTop: 16 }}>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <ReferenceArea y1={60} y2={75} fill="#16a34a" fillOpacity={0.06} />
                    <XAxis dataKey="ts" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit="°" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="T подачи (t1)" stroke="#dc2626" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="T обратки (t2)" stroke="#2563eb" dot={false} strokeWidth={1.5} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                <p className="footnote">Зелёная зона — норматив подачи ГВС 60–75 °C. Разрывы линии — недостоверные часы.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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

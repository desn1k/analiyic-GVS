import { useEffect, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ReferenceArea,
} from "recharts";
import { getDeviceSummary, getDeviceHourly, getObjectOutages } from "../api/client";

const IMPACT_COLOR = {
  "прекращение": "#dc2626",
  "ограничение": "#f59e0b",
  "иное": "#9ca3af",
};

function fmtDT(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtTs(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
}

// Вертикальная подпись внутри зоны отключения: причина + период.
function OutageLabel({ text, color, viewBox }) {
  if (!viewBox) return null;
  const { x, y, width, height } = viewBox;
  const cx = x + width / 2;
  const cy = y + height - 6;
  const maxChars = Math.max(6, Math.floor((height - 12) / 6.2));
  const shown = text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
  return (
    <text
      x={cx}
      y={cy}
      fill={color}
      fontSize={10}
      fontWeight={600}
      textAnchor="start"
      transform={`rotate(-90, ${cx}, ${cy})`}
    >
      {shown}
    </text>
  );
}

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

function fmtLoad(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(3);
}

export default function DevicePointModal({ row, onClose }) {
  const [summary, setSummary] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [outages, setOutages] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const tuUuid = row?.tu_id;

  useEffect(() => {
    if (!tuUuid) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getDeviceSummary(tuUuid),
      getDeviceHourly(tuUuid, { limit: 20000 }),
      row?.object_id ? getObjectOutages(row.object_id).catch(() => []) : Promise.resolve([]),
    ])
      .then(([s, h, o]) => {
        if (!alive) return;
        setSummary(s);
        setHourly(h);
        setOutages(o || []);
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
    "Объём (M1), т": h.valid ? h.m1 : null,
  }));
  const hasVolume = chartData.some((d) => d["Объём (M1), т"] > 0);

  // Сопоставляем интервалы отключений с метками часовой шкалы графика.
  const times = (hourly || []).map((h) => new Date(h.ts).getTime());
  const outageBands = (outages || []).map((o, idx) => {
    const start = o.start_fact ? new Date(o.start_fact).getTime() : null;
    const end = o.end_fact ? new Date(o.end_fact).getTime() : null;
    if (!times.length || start === null) return null;
    let i1 = times.findIndex((t) => t >= start);
    if (i1 === -1) return null;                       // отключение позже данных
    let i2 = end === null ? times.length - 1 : times.reduce((acc, t, i) => (t <= end ? i : acc), -1);
    if (i2 < 0) return null;                          // отключение раньше данных
    if (i2 < i1) i2 = i1;
    const period = `${fmtDT(o.start_fact)} — ${fmtDT(o.end_fact)}`;
    const label = `${o.reason || o.impact || "отключение"} · ${period}`;
    return { key: idx, x1: chartData[i1].ts, x2: chartData[i2].ts, impact: o.impact, label };
  }).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{row?.registry_name || row?.object_name}</h3>
            <div className="modal-sub">
              {row?.object_name}{row?.tu_name ? ` · ${row.tu_name}` : ""}
              {row?.aiis_url && (
                <> · <a href={row.aiis_url} target="_blank" rel="noreferrer">Открыть в АИИС ↗</a></>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {(row?.heat_system || row?.design_t_supply || row?.q_gvs) && (
            <div className="device-stats" style={{ marginBottom: 8 }}>
              {row?.heat_system && <Stat label="Система теплоснабжения" value={row.heat_system} />}
              {row?.design_t_supply != null && (
                <Stat label="Расч. T прям./обр." value={`${fmtNum(row.design_t_supply)} / ${fmtNum(row.design_t_return)} °C`} />
              )}
              {row?.q_gvs != null && <Stat label="Qгвс, Гкал/ч" value={fmtLoad(row.q_gvs)} />}
              {row?.q_heating != null && <Stat label="Qот, Гкал/ч" value={fmtLoad(row.q_heating)} />}
            </div>
          )}
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
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <ReferenceArea yAxisId="temp" y1={0} y2={40} fill="#f87171" fillOpacity={0.10} ifOverflow="extendDomain" />
                    <ReferenceArea yAxisId="temp" y1={40} y2={60} fill="#fde047" fillOpacity={0.14} ifOverflow="extendDomain" />
                    <ReferenceArea yAxisId="temp" y1={60} y2={75} fill="#16a34a" fillOpacity={0.10} ifOverflow="extendDomain" />
                    {outageBands.map((b) => (
                      <ReferenceArea
                        key={b.key}
                        yAxisId="temp"
                        x1={b.x1}
                        x2={b.x2}
                        fill={IMPACT_COLOR[b.impact] || IMPACT_COLOR["иное"]}
                        fillOpacity={0.14}
                        stroke={IMPACT_COLOR[b.impact] || IMPACT_COLOR["иное"]}
                        strokeOpacity={0.4}
                        ifOverflow="extendDomain"
                        label={<OutageLabel text={b.label} color={IMPACT_COLOR[b.impact] || IMPACT_COLOR["иное"]} />}
                      />
                    ))}
                    <XAxis dataKey="ts" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis yAxisId="temp" tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit="°" />
                    {hasVolume && (
                      <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 11 }} domain={[0, "auto"]} />
                    )}
                    <Tooltip />
                    <Legend />
                    {hasVolume && (
                      <Bar yAxisId="vol" dataKey="Объём (M1), т" fill="#93c5fd" barSize={6} />
                    )}
                    <Line yAxisId="temp" type="monotone" dataKey="T подачи (t1)" stroke="#dc2626" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="temp" type="monotone" dataKey="T обратки (t2)" stroke="#2563eb" dot={false} strokeWidth={1.5} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="footnote">
                  Горизонтальные зоны по T подачи: красная &lt;40 °C, жёлтая 40–60 °C, зелёная 60–75 °C (норматив).
                  Синие столбцы — объём M1, т (правая ось). Вертикальные цветные зоны — отключения ГВС.
                  Разрывы линии — недостоверные часы.
                </p>

                {outages.length > 0 && (
                  <div className="outage-list">
                    <h4 className="dash-section">Отключения ГВС по этому адресу ({outages.length})</h4>
                    {outages.map((o, i) => (
                      <div className="outage-item" key={i}>
                        <span
                          className="outage-badge"
                          style={{ background: IMPACT_COLOR[o.impact] || IMPACT_COLOR["иное"] }}
                        >
                          {o.impact || "—"}
                        </span>
                        <div className="outage-text">
                          <div>
                            <b>{o.reason || "Причина не указана"}</b>
                            {o.kind ? ` · ${o.kind}` : ""}{o.status ? ` · ${o.status}` : ""}
                          </div>
                          <div className="metric-sub">
                            {fmtDT(o.start_fact)} — {fmtDT(o.end_fact)}
                            {o.number ? ` · №${o.number}` : ""}
                            {o.note ? ` · ${o.note}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

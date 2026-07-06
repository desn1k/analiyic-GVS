import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { getWeekSources, getSourceDynamics, getWeekSourceObjects } from "../api/client";
import { formatPeriod } from "../utils/format";
import DevicePointModal from "./DevicePointModal";

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

export default function WeekSourcesModal({ period, onClose }) {
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);       // источник, раскрытый в объекты
  const [objects, setObjects] = useState({});           // source -> объекты
  const [dynFor, setDynFor] = useState(null);           // источник для графика динамики
  const [dyn, setDyn] = useState(null);
  const [objectRow, setObjectRow] = useState(null);     // объект для карточки-графика

  useEffect(() => {
    setLoading(true);
    getWeekSources(period.period_id)
      .then((d) => setSources(d.sources || []))
      .finally(() => setLoading(false));
  }, [period.period_id]);

  const toggleExpand = (src) => {
    if (expanded === src) { setExpanded(null); return; }
    setExpanded(src);
    if (!objects[src]) {
      getWeekSourceObjects(period.period_id, { source_name: src })
        .then((d) => setObjects((prev) => ({ ...prev, [src]: d.objects || [] })));
    }
  };

  const openDynamics = (src) => {
    setDynFor(src); setDyn(null);
    getSourceDynamics({ source_name: src }).then((d) => setDyn(d.points || []));
  };

  const filtered = (sources || []).filter(
    (s) => !search || s.source_name.toLowerCase().includes(search.toLowerCase())
  );

  const topChart = filtered.slice(0, 15).map((s) => ({
    name: s.source_name.length > 22 ? s.source_name.slice(0, 21) + "…" : s.source_name,
    "% некачества": s.violation_pct,
  }));
  const dynChart = (dyn || []).map((p) => ({
    period: formatPeriod(p.period_start, p.period_end),
    "% некачества": p.violation_pct,
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Разбивка по источникам</h3>
            <div className="modal-sub">Неделя: {formatPeriod(period.period_start, period.period_end)}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && <p className="empty-hint">Загрузка…</p>}

          {!loading && sources && (
            <>
              <input
                type="text"
                className="source-filter"
                placeholder="Фильтр по источнику…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {filtered.length > 0 && (
                <ResponsiveContainer width="100%" height={Math.max(160, topChart.length * 22)}>
                  <BarChart data={topChart} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="% некачества" fill="#dc2626" barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              <p className="footnote">Нажмите на источник — раскроется список объектов; по объекту откроется график.</p>

              <div className="table-wrap" style={{ maxHeight: "50vh", marginTop: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Источник</th>
                      <th>Объектов</th>
                      <th>С некач.</th>
                      <th>Объём, м³</th>
                      <th>% некач.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <SourceRows
                        key={s.source_name}
                        s={s}
                        expanded={expanded === s.source_name}
                        objects={objects[s.source_name]}
                        onToggle={() => toggleExpand(s.source_name)}
                        onDynamics={() => openDynamics(s.source_name)}
                        onOpenObject={setObjectRow}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {dynFor && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="dash-section">Динамика по неделям: {dynFor}</h4>
                  {dyn === null ? <p className="empty-hint">Загрузка…</p> : dynChart.length === 0 ? (
                    <p className="empty-hint">Нет данных.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={dynChart} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip />
                        <Line type="monotone" dataKey="% некачества" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {objectRow && <DevicePointModal row={objectRow} onClose={() => setObjectRow(null)} />}
    </div>
  );
}

function SourceRows({ s, expanded, objects, onToggle, onDynamics, onOpenObject }) {
  return (
    <>
      <tr className={expanded ? "sorted" : ""}>
        <td className="wrap-cell" style={{ textAlign: "left" }}>
          <button className="link-cell" onClick={onToggle}>{expanded ? "▾ " : "▸ "}{s.source_name}</button>
        </td>
        <td>{s.objects_count}</td>
        <td>{s.objects_with_violation}</td>
        <td>{fmtNum(s.volume_total)}</td>
        <td className={s.violation_pct > 0 ? "violation" : ""}>{fmtNum(s.violation_pct)}%</td>
        <td><button className="link-cell" onClick={onDynamics} title="Динамика по неделям">📈</button></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: "#f8f9fc", padding: "6px 12px" }}>
            {!objects ? <span className="empty-hint">Загрузка объектов…</span> : objects.length === 0 ? (
              <span className="empty-hint">Нет объектов.</span>
            ) : (
              <div className="source-objects">
                {objects.map((o) => (
                  <div key={o.object_id} className="source-object-row">
                    <button
                      className="link-cell"
                      onClick={() => onOpenObject({ tu_id: o.tu_id, object_id: o.object_id, object_name: o.object_name })}
                      title="Открыть график объекта"
                    >
                      {o.object_name || o.object_id}
                    </button>
                    <span className={`source-object-pct${o.violation_pct > 0 ? " violation" : ""}`}>{fmtNum(o.violation_pct)}%</span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

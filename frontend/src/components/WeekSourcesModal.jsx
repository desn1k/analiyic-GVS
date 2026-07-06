import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { getWeekSources, getSourceDynamics } from "../api/client";
import { formatPeriod } from "../utils/format";

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

export default function WeekSourcesModal({ period, onClose }) {
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);   // источник для динамики
  const [dyn, setDyn] = useState(null);

  useEffect(() => {
    setLoading(true);
    getWeekSources(period.period_id)
      .then((d) => setSources(d.sources || []))
      .finally(() => setLoading(false));
  }, [period.period_id]);

  const openDynamics = (src) => {
    setSelected(src);
    setDyn(null);
    getSourceDynamics({ source_name: src }).then((d) => setDyn(d.points || []));
  };

  const topChart = (sources || []).slice(0, 15).map((s) => ({
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

          {!loading && sources && sources.length === 0 && (
            <p className="empty-hint">Нет данных по источникам за эту неделю.</p>
          )}

          {!loading && sources && sources.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={Math.max(180, topChart.length * 22)}>
                <BarChart data={topChart} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="% некачества" fill="#dc2626" barSize={12} />
                </BarChart>
              </ResponsiveContainer>

              <p className="footnote">Топ-15 источников по % некачества. Нажмите на источник в таблице — покажу его динамику по неделям.</p>

              <div className="table-wrap" style={{ maxHeight: "45vh", marginTop: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Источник</th>
                      <th>Объектов</th>
                      <th>С некач.</th>
                      <th>Объём, м³</th>
                      <th>Объём некач., м³</th>
                      <th>% некач.</th>
                      <th>Перегревов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s) => (
                      <tr key={s.source_name} className={selected === s.source_name ? "sorted" : ""}>
                        <td className="wrap-cell" style={{ textAlign: "left" }}>
                          <button className="link-cell" onClick={() => openDynamics(s.source_name)}>{s.source_name}</button>
                        </td>
                        <td>{s.objects_count}</td>
                        <td>{s.objects_with_violation}</td>
                        <td>{fmtNum(s.volume_total)}</td>
                        <td>{fmtNum(s.violation_volume)}</td>
                        <td className={s.violation_pct > 0 ? "violation" : ""}>{fmtNum(s.violation_pct)}%</td>
                        <td>{s.overheat_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="dash-section">Динамика по неделям: {selected}</h4>
                  {dyn === null ? (
                    <p className="empty-hint">Загрузка…</p>
                  ) : dynChart.length === 0 ? (
                    <p className="empty-hint">Нет данных.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
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
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  getWeekSources, getSourceDynamics, getWeekSourceObjects, getWeekOutageStats,
} from "../api/client";
import { formatPeriod } from "../utils/format";
import DevicePointModal from "./DevicePointModal";

const IMPACT_COLOR = { "прекращение": "#dc2626", "ограничение": "#f59e0b", "иное": "#9ca3af" };

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

export default function WeekSourcesModal({ period, onClose }) {
  const [sources, setSources] = useState(null);
  const [finalSources, setFinalSources] = useState([]);
  const [finalFilter, setFinalFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("violation_pct");

  const [selected, setSelected] = useState(null);        // выбранный источник
  const [objects, setObjects] = useState({});             // source -> объекты (кэш)
  const [objSearch, setObjSearch] = useState("");
  const [showDyn, setShowDyn] = useState(false);
  const [dyn, setDyn] = useState(null);
  const [objectRow, setObjectRow] = useState(null);       // объект для карточки-графика

  const [outageStats, setOutageStats] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getWeekSources(period.period_id),
      getWeekOutageStats(period.period_id).catch(() => null),
    ])
      .then(([d, os]) => {
        setSources(d.sources || []);
        setFinalSources(d.final_sources || []);
        setOutageStats(os);
      })
      .finally(() => setLoading(false));
  }, [period.period_id]);

  const selectSource = (src) => {
    setSelected(src);
    setShowDyn(false);
    setObjSearch("");
    if (!objects[src]) {
      getWeekSourceObjects(period.period_id, { source_name: src })
        .then((d) => setObjects((prev) => ({ ...prev, [src]: d.objects || [] })));
    }
  };

  const openDynamics = () => {
    setShowDyn(true); setDyn(null);
    getSourceDynamics({ source_name: selected }).then((d) => setDyn(d.points || []));
  };

  const filtered = useMemo(() => {
    let list = (sources || []).filter(
      (s) => (!search || s.source_name.toLowerCase().includes(search.toLowerCase()))
        && (!finalFilter || s.final_source === finalFilter)
    );
    list = [...list].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
    return list;
  }, [sources, search, finalFilter, sortBy]);

  const selectedObjects = selected ? (objects[selected] || []) : [];
  const filteredObjects = objSearch
    ? selectedObjects.filter((o) => (o.object_name || "").toLowerCase().includes(objSearch.toLowerCase()))
    : selectedObjects;
  const selectedInfo = (sources || []).find((s) => s.source_name === selected);

  const pieData = (outageStats?.breakdown || []).map((b) => ({
    name: b.impact, value: b.count, objects: b.objects_count,
  }));

  const dynChart = (dyn || []).map((p) => ({
    period: formatPeriod(p.period_start, p.period_end),
    "% некачества": p.violation_pct,
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Анализ недели {formatPeriod(period.period_start, period.period_end)}</h3>
            <div className="modal-sub">Источники, объекты и отключения ГВС за период</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && <p className="empty-hint">Загрузка…</p>}

          {!loading && sources && (
            <>
              {/* Верхняя сводка: плитки + круговая диаграмма отключений */}
              <div className="week-overview">
                <div className="tiles week-tiles">
                  <div className="tile"><div className="tile-num">{sources.length}</div><div className="tile-lbl">Источников</div></div>
                  <div className="tile danger"><div className="tile-num">{sources.filter((s) => s.objects_with_violation > 0).length}</div><div className="tile-lbl">С нарушением</div></div>
                  <div className="tile"><div className="tile-num">{outageStats?.total ?? "—"}</div><div className="tile-lbl">Отключений за неделю</div></div>
                </div>

                {pieData.length > 0 && (
                  <div className="outage-pie">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                          {pieData.map((d) => <Cell key={d.name} fill={IMPACT_COLOR[d.name] || IMPACT_COLOR["иное"]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n, p) => [`${v} (объектов: ${p.payload.objects})`, n]} />
                        <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Двухпанельный макет: список источников | детали выбранного */}
              <div className="split-pane">
                <div className="split-col split-col-left">
                  <div className="split-filters">
                    {finalSources.length > 0 && (
                      <select value={finalFilter} onChange={(e) => setFinalFilter(e.target.value)}>
                        <option value="">Конечный источник: все ({finalSources.length})</option>
                        {finalSources.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    )}
                    <input
                      type="text" className="source-filter" placeholder="Поиск источника…"
                      value={search} onChange={(e) => setSearch(e.target.value)}
                    />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="violation_pct">Сорт.: % некачества</option>
                      <option value="volume_total">Сорт.: объём</option>
                      <option value="objects_count">Сорт.: кол-во объектов</option>
                    </select>
                  </div>

                  <div className="scroll-list">
                    {filtered.length === 0 && <p className="empty-hint">Ничего не найдено.</p>}
                    {filtered.map((s) => (
                      <button
                        key={s.source_name}
                        className={`source-list-item ${selected === s.source_name ? "active" : ""}`}
                        onClick={() => selectSource(s.source_name)}
                      >
                        <div className="source-list-name">{s.source_name}</div>
                        {s.final_source && <div className="source-list-final">{s.final_source}</div>}
                        <div className="source-list-stats">
                          <span>{s.objects_count} об.</span>
                          <span className={s.violation_pct > 0 ? "violation" : ""}>{fmtNum(s.violation_pct)}%</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="split-col split-col-right">
                  {!selected && <p className="empty-hint">Выберите источник слева, чтобы увидеть его объекты.</p>}

                  {selected && (
                    <>
                      <div className="detail-header">
                        <div>
                          <h4 style={{ margin: 0 }}>{selected}</h4>
                          {selectedInfo?.final_source && <div className="metric-sub">Конечный источник: {selectedInfo.final_source}</div>}
                        </div>
                        <button type="button" className="link-cell" onClick={openDynamics}>📈 Динамика по неделям</button>
                      </div>

                      {selectedInfo && (
                        <div className="device-stats" style={{ marginBottom: 10 }}>
                          <div className="device-stat"><div className="device-stat-label">Объектов</div><div className="device-stat-value">{selectedInfo.objects_count}</div></div>
                          <div className="device-stat"><div className="device-stat-label">С нарушением</div><div className={`device-stat-value${selectedInfo.objects_with_violation ? " danger" : ""}`}>{selectedInfo.objects_with_violation}</div></div>
                          <div className="device-stat"><div className="device-stat-label">Объём, м³</div><div className="device-stat-value">{fmtNum(selectedInfo.volume_total)}</div></div>
                          <div className="device-stat"><div className="device-stat-label">% некачества</div><div className={`device-stat-value${selectedInfo.violation_pct ? " danger" : ""}`}>{fmtNum(selectedInfo.violation_pct)}%</div></div>
                        </div>
                      )}

                      {showDyn && (
                        <div style={{ marginBottom: 14 }}>
                          {dyn === null ? <p className="empty-hint">Загрузка…</p> : dynChart.length === 0 ? (
                            <p className="empty-hint">Нет данных.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={180}>
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

                      <input
                        type="text" className="source-filter" placeholder="Поиск объекта…"
                        value={objSearch} onChange={(e) => setObjSearch(e.target.value)}
                        style={{ marginBottom: 8 }}
                      />
                      <div className="scroll-list">
                        {!objects[selected] && <p className="empty-hint">Загрузка объектов…</p>}
                        {objects[selected] && filteredObjects.length === 0 && <p className="empty-hint">Нет объектов.</p>}
                        {filteredObjects.map((o) => (
                          <button
                            key={o.object_id}
                            className="object-list-item"
                            onClick={() => setObjectRow({ tu_id: o.tu_id, object_id: o.object_id, object_name: o.object_name })}
                            title="Открыть график объекта"
                          >
                            <span className="object-list-name">{o.object_name || o.object_id}</span>
                            <span className={`object-list-pct${o.violation_pct > 0 ? " violation" : ""}`}>{fmtNum(o.violation_pct)}%</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {objectRow && <DevicePointModal row={objectRow} onClose={() => setObjectRow(null)} />}
    </div>
  );
}

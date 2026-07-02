import { useState } from "react";
import { getGvsQuality, gvsQualityExportUrl } from "../api/client";

function fmt(v) {
  return v === null || v === undefined ? "—" : v;
}

function verdictClass(v) {
  if (v.startsWith("Норма")) return "ok";
  if (v.startsWith("Недостаточно") || v.startsWith("Нет зачтённых")) return "muted";
  return "bad";
}

export default function GvsQualityAnalysis() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chronic, setChronic] = useState(50);
  const [reliability, setReliability] = useState(52);
  const [onlyViol, setOnlyViol] = useState(true);
  const [excludeNoDraw, setExcludeNoDraw] = useState(true);
  const [scope, setScope] = useState("report");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildParams = () => ({
    date_from: from, date_to: to,
    chronic_pct: chronic, min_reliability_pct: reliability,
    only_violations: onlyViol, exclude_no_draw: excludeNoDraw, scope,
  });

  const run = () => {
    if (!from || !to) { setError("Укажите начало и конец периода"); return; }
    setError(null);
    setLoading(true);
    getGvsQuality(buildParams())
      .then(setData)
      .catch((e) => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  };

  const download = () => {
    if (!from || !to) { setError("Укажите начало и конец периода"); return; }
    window.open(gvsQualityExportUrl(buildParams()), "_blank");
  };

  return (
    <div>
      <p className="metric-sub" style={{ marginBottom: 12 }}>
        Расчёт из почасовых приборных данных по СанПиН: день ≥57 °C, ночь 00–05 ≥55 °C, перегрев &gt;75 °C.
        Исключаются недостоверные часы, часы отключений ГВС и (опц.) часы без водоразбора.
        Причина недогрева определяется по иерархии: системная (источник/сеть) или локальная (внутридомовая).
      </p>
      <div className="quality-controls">
        <label>С <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>По <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Хроническое, % <input type="number" min="0" max="100" value={chronic} onChange={(e) => setChronic(Number(e.target.value))} /></label>
        <label>Достоверность, % <input type="number" min="0" max="100" value={reliability} onChange={(e) => setReliability(Number(e.target.value))} /></label>
        <label>Охват
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="report">База ГВС (точки учёта)</option>
            <option value="all">Все приборные точки</option>
          </select>
        </label>
        <label className="quality-check"><input type="checkbox" checked={excludeNoDraw} onChange={(e) => setExcludeNoDraw(e.target.checked)} /> исключать часы без водоразбора</label>
        <label className="quality-check"><input type="checkbox" checked={onlyViol} onChange={(e) => setOnlyViol(e.target.checked)} /> только с нарушениями</label>
        <button className="analyze-btn" onClick={run} disabled={loading}>{loading ? "Анализ…" : "Анализ"}</button>
        <button className="download-btn" onClick={download} disabled={loading} title="Скачать отчёт в Excel">⬇ Скачать отчёт (xlsx)</button>
      </div>

      {error && <p className="empty-hint" style={{ color: "var(--danger)" }}>{error}</p>}

      {data && (
        <>
          <p className="applied-filters">
            Период: {new Date(data.date_from).toLocaleString("ru-RU")} — {new Date(data.date_to).toLocaleString("ru-RU")}.
            Найдено записей: {data.count}.
          </p>
          <div className="table-wrap" style={{ maxHeight: "60vh" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Объект</th>
                  <th>Зачтено ч</th>
                  <th>% наруш.</th>
                  <th>Недогрев ч</th>
                  <th>Перегрев ч</th>
                  <th>Искл. откл.</th>
                  <th>Без разбора</th>
                  <th>Достов. %</th>
                  <th>Сред. T1</th>
                  <th style={{ textAlign: "left" }}>Вердикт</th>
                  <th style={{ textAlign: "left" }}>Причина</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.tu_uuid}>
                    <td className="wrap-cell" style={{ textAlign: "left" }} title={r.object_name}>{r.object_name || r.tu_uuid}</td>
                    <td>{r.hours_counted}</td>
                    <td className={r.viol_pct > 0 ? "violation" : ""}>{r.viol_pct}%</td>
                    <td>{r.viol_low}</td>
                    <td>{r.viol_high}</td>
                    <td>{r.hours_excluded_outage}</td>
                    <td>{r.hours_excluded_noflow}</td>
                    <td className={r.reliability_pct < reliability ? "low-confidence-text" : ""}>{r.reliability_pct}%</td>
                    <td>{fmt(r.avg_t1)}</td>
                    <td className={`wrap-cell verdict-${verdictClass(r.verdict)}`} style={{ textAlign: "left" }}>{r.verdict}</td>
                    <td className="wrap-cell metric-sub" style={{ textAlign: "left" }} title={r.cause}>{r.cause || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

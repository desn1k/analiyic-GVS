import { useState } from "react";
import { getGvsQuality } from "../api/client";

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = () => {
    if (!from || !to) { setError("Укажите начало и конец периода"); return; }
    setError(null);
    setLoading(true);
    getGvsQuality({
      date_from: from, date_to: to,
      chronic_pct: chronic, min_reliability_pct: reliability,
      only_violations: onlyViol,
    })
      .then(setData)
      .catch((e) => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <p className="metric-sub" style={{ marginBottom: 12 }}>
        Расчёт из почасовых приборных данных по СанПиН: день ≥57 °C, ночь 00–05 ≥55 °C, перегрев &gt;75 °C.
        Исключаются недостоверные часы и часы отключений ГВС.
      </p>
      <div className="quality-controls">
        <label>С <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>По <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Хроническое, % <input type="number" min="0" max="100" value={chronic} onChange={(e) => setChronic(Number(e.target.value))} /></label>
        <label>Достоверность, % <input type="number" min="0" max="100" value={reliability} onChange={(e) => setReliability(Number(e.target.value))} /></label>
        <label className="quality-check"><input type="checkbox" checked={onlyViol} onChange={(e) => setOnlyViol(e.target.checked)} /> только с нарушениями</label>
        <button className="analyze-btn" onClick={run} disabled={loading}>{loading ? "Анализ…" : "Анализ"}</button>
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
                  <th>Искл. (откл.)</th>
                  <th>Достов. %</th>
                  <th>Сред. T1</th>
                  <th style={{ textAlign: "left" }}>Вердикт</th>
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
                    <td className={r.reliability_pct < reliability ? "low-confidence-text" : ""}>{r.reliability_pct}%</td>
                    <td>{fmt(r.avg_t1)}</td>
                    <td className={`wrap-cell verdict-${verdictClass(r.verdict)}`} style={{ textAlign: "left" }}>{r.verdict}</td>
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

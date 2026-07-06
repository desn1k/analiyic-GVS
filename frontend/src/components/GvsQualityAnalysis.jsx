import { useState } from "react";
import { getGvsQuality, gvsQualityExportUrl } from "../api/client";
import Hint from "./Hint";

function fmt(v) {
  return v === null || v === undefined ? "—" : v;
}
function verdictClass(v) {
  if (v.startsWith("Норма")) return "ok";
  if (v.startsWith("Недостаточно") || v.startsWith("Нет зачтённых")) return "muted";
  return "bad";
}
function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function GvsQualityAnalysis({ dataRange }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chronic, setChronic] = useState(50);
  const [reliability, setReliability] = useState(52);
  const [onlyViol, setOnlyViol] = useState(true);
  const [excludeNoDraw, setExcludeNoDraw] = useState(true);
  const [scope, setScope] = useState("report");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasRange = dataRange?.ts_min && dataRange?.ts_max;

  const setPreset = (kind) => {
    if (!hasRange) return;
    const max = new Date(dataRange.ts_max);
    const min = new Date(dataRange.ts_min);
    if (kind === "week") {
      const start = new Date(max.getTime() - 6 * 24 * 3600 * 1000);
      setFrom(toLocalInput(start < min ? min : start));
      setTo(toLocalInput(max));
    } else {
      setFrom(toLocalInput(min));
      setTo(toLocalInput(max));
    }
  };

  const buildParams = () => ({
    date_from: from, date_to: to,
    chronic_pct: chronic, min_reliability_pct: reliability,
    only_violations: onlyViol, exclude_no_draw: excludeNoDraw, scope,
  });

  const run = () => {
    if (!from || !to) { setError("Укажите период (шаг 1)"); return; }
    setError(null);
    setLoading(true);
    getGvsQuality(buildParams())
      .then(setData)
      .catch((e) => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  };
  const download = () => {
    if (!from || !to) { setError("Укажите период (шаг 1)"); return; }
    window.open(gvsQualityExportUrl(buildParams()), "_blank");
  };

  // Плитки-сводка по результату.
  const tiles = data && (() => {
    const rows = data.rows;
    const viol = rows.filter((r) => r.viol_pct > 0).length;
    const chr = rows.filter((r) => r.verdict.includes("хроническое")).length;
    const norm = rows.filter((r) => r.verdict.startsWith("Норма")).length;
    const insuf = rows.filter((r) => r.verdict.startsWith("Недостаточно") || r.verdict.startsWith("Нет зачтённых")).length;
    return { total: data.count, viol, chr, norm, insuf };
  })();

  return (
    <div>
      <p className="lead-text">
        Показывает объекты с некачественной подачей ГВС по приборным данным.
        Норматив: днём ≥57 °C, ночью (00–05) ≥55 °C, перегрев &gt;75 °C.
      </p>

      {/* Шаг 1 — период */}
      <div className="wizard-step">
        <span className="step-badge">1</span>
        <span className="step-label">Выберите период</span>
        {hasRange && (
          <div className="preset-btns">
            <button type="button" onClick={() => setPreset("week")}>Последняя неделя данных</button>
            <button type="button" onClick={() => setPreset("all")}>Весь период данных</button>
          </div>
        )}
      </div>
      <div className="quality-controls">
        <label>С <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>По <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      {/* Шаг 2 — запуск */}
      <div className="wizard-step">
        <span className="step-badge">2</span>
        <span className="step-label">Получите результат</span>
      </div>
      <div className="quality-controls">
        <button className="analyze-btn" onClick={run} disabled={loading}>{loading ? "Считаю…" : "Показать нарушения"}</button>
        <button className="download-btn" onClick={download} disabled={loading}>⬇ Скачать в Excel</button>
        <button type="button" className="link-cell" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Скрыть настройки" : "Дополнительные настройки"}
        </button>
      </div>

      {showAdvanced && (
        <div className="quality-controls advanced-box">
          <label>
            Хроническое, % <Hint text="Если доля часов с нарушением выше этого значения — считаем нарушение хроническим." />
            <input type="number" min="0" max="100" value={chronic} onChange={(e) => setChronic(Number(e.target.value))} />
          </label>
          <label>
            Достоверность, % <Hint text="Минимальная доля корректных часов, чтобы выносить вердикт. Ниже — «недостаточно данных»." />
            <input type="number" min="0" max="100" value={reliability} onChange={(e) => setReliability(Number(e.target.value))} />
          </label>
          <label>
            Охват <Hint text="«База ГВС» — только контролируемые точки учёта из недельного отчёта. «Все» — включая ЦТП и источники." />
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="report">База ГВС (точки учёта)</option>
              <option value="all">Все приборные точки</option>
            </select>
          </label>
          <label className="quality-check"><input type="checkbox" checked={excludeNoDraw} onChange={(e) => setExcludeNoDraw(e.target.checked)} /> не учитывать часы без водоразбора</label>
          <label className="quality-check"><input type="checkbox" checked={onlyViol} onChange={(e) => setOnlyViol(e.target.checked)} /> показывать только с нарушениями</label>
        </div>
      )}

      {error && <p className="empty-hint" style={{ color: "var(--danger)" }}>{error}</p>}

      {data && (
        <>
          <div className="tiles">
            <div className="tile"><div className="tile-num">{tiles.total}</div><div className="tile-lbl">Проанализировано</div></div>
            <div className="tile danger"><div className="tile-num">{tiles.viol}</div><div className="tile-lbl">С нарушением</div></div>
            <div className="tile danger"><div className="tile-num">{tiles.chr}</div><div className="tile-lbl">Хронических</div></div>
            <div className="tile ok"><div className="tile-num">{tiles.norm}</div><div className="tile-lbl">В норме</div></div>
            <div className="tile muted"><div className="tile-num">{tiles.insuf}</div><div className="tile-lbl">Мало данных</div></div>
          </div>
          <p className="applied-filters">
            Период: {new Date(data.date_from).toLocaleString("ru-RU")} — {new Date(data.date_to).toLocaleString("ru-RU")}.
          </p>
          <div className="table-wrap" style={{ maxHeight: "60vh" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Объект</th>
                  <th>Зачтено ч <Hint text="Часы, попавшие в расчёт после исключений (недостоверные, отключения, без разбора)." /></th>
                  <th>% нарушения</th>
                  <th style={{ textAlign: "left" }}>Вердикт</th>
                  <th style={{ textAlign: "left" }}>Причина</th>
                  <th>Достоверность</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.tu_uuid}>
                    <td className="wrap-cell" style={{ textAlign: "left" }} title={r.object_name}>{r.object_name || r.tu_uuid}</td>
                    <td>{r.hours_counted}</td>
                    <td className={r.viol_pct > 0 ? "violation" : ""}>{r.viol_pct}%</td>
                    <td className={`wrap-cell verdict-${verdictClass(r.verdict)}`} style={{ textAlign: "left" }}>{r.verdict}</td>
                    <td className="wrap-cell metric-sub" style={{ textAlign: "left" }} title={r.cause}>{r.cause || "—"}</td>
                    <td className={r.reliability_pct < reliability ? "low-confidence-text" : ""}>{r.reliability_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Полная таблица со всеми столбцами (недогрев/перегрев по часам, исключённые часы) — в кнопке «Скачать в Excel».
          </p>
        </>
      )}
    </div>
  );
}

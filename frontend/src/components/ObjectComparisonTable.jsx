import { formatPeriod } from "../utils/format";

const OBJ_COL_W = 240;
const TYPE_COL_W = 150;
const PERIOD_MIN_W = 150;
const MAX_FIT_PERIODS = 10;

export default function ObjectComparisonTable({ data }) {
  if (!data?.periods?.length || !data?.objects?.length) {
    return <p className="empty-hint">Нет данных для сравнения по неделям.</p>;
  }

  const { periods, objects } = data;
  const fit = periods.length <= MAX_FIT_PERIODS;

  // До 10 периодов — таблица растягивается на всю ширину без скролла.
  // Больше 10 — фиксированная ширина столбцов, включается горизонтальный скролл.
  const periodWidth = fit
    ? `calc((100% - ${OBJ_COL_W + TYPE_COL_W}px) / ${periods.length})`
    : `${PERIOD_MIN_W}px`;
  const tableWidth = fit
    ? "100%"
    : `${OBJ_COL_W + TYPE_COL_W + periods.length * PERIOD_MIN_W}px`;

  return (
    <div className="table-wrap">
      <table style={{ width: tableWidth }}>
        <colgroup>
          <col style={{ width: OBJ_COL_W }} />
          <col style={{ width: TYPE_COL_W }} />
          {periods.map((p) => (
            <col key={p.id} style={{ width: periodWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky-col-1">Объект</th>
            <th className="sticky-col-2">Тип объекта</th>
            {periods.map((p) => (
              <th key={p.id}>{formatPeriod(p.period_start, p.period_end)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {objects.map((o) => (
            <tr key={o.object_id}>
              <td className="wrap-cell sticky-col-1" title={o.object_name}>{o.object_name}</td>
              <td className="wrap-cell sticky-col-2">{o.object_type || "—"}</td>
              {periods.map((p) => {
                const m = o.periods[p.id];
                if (!m) return <td key={p.id}>—</td>;
                return (
                  <td key={p.id}>
                    <div className={m.violation_pct > 0 ? "violation" : ""}>
                      {fmtNum(m.violation_pct)}% нарушений{m.has_overheat ? " 🔥" : ""}
                    </div>
                    <div className="metric-sub">Объём: {fmtNum(m.volume_total)} м³</div>
                    <div className={`metric-sub${m.data_quality_pct < 52 ? " low-confidence-text" : ""}`}>
                      Достоверность: {fmtNum(m.data_quality_pct)}%
                    </div>
                    {m.probable_cause && (
                      <div className="metric-sub">Причина: {m.probable_cause}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

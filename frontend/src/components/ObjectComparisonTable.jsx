import { formatPeriod } from "../utils/format";

export default function ObjectComparisonTable({ data }) {
  if (!data?.periods?.length || !data?.objects?.length) {
    return <p className="empty-hint">Нет данных для сравнения по неделям.</p>;
  }

  const { periods, objects } = data;

  return (
    <div className="table-wrap">
      <table>
        <colgroup>
          <col style={{ width: 260 }} />
          <col style={{ width: 170 }} />
          {periods.map((p) => (
            <col key={p.id} style={{ width: 170 }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Объект</th>
            <th>Тип объекта</th>
            {periods.map((p) => (
              <th key={p.id}>{formatPeriod(p.period_start, p.period_end)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {objects.map((o) => (
            <tr key={o.object_id}>
              <td className="wrap-cell sticky-col" title={o.object_name}>{o.object_name}</td>
              <td className="wrap-cell">{o.object_type || "—"}</td>
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

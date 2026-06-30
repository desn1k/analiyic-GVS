const COLUMNS = [
  { key: "object_name", label: "Объект" },
  { key: "tu_name", label: "ТУ" },
  { key: "object_type", label: "Тип объекта" },
  { key: "scheme", label: "Схема" },
  { key: "avg_temp_gvs", label: "Сред. T, °C" },
  { key: "volume_total", label: "Объём, м³" },
  { key: "violation_pct", label: "% с нарушением" },
  { key: "hours_violation_low", label: "Часов занижение" },
  { key: "hours_violation_high", label: "Часов завышение" },
  { key: "data_quality_pct", label: "Достоверность, %" },
];

export default function TuTable({ rows, sortBy, order, onSort }) {
  if (!rows?.length) {
    return <p className="empty-hint">Нет точек учёта по выбранным фильтрам.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} onClick={() => onSort(c.key)} className={sortBy === c.key ? "sorted" : ""}>
                {c.label}{sortBy === c.key ? (order === "desc" ? " ▼" : " ▲") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.data_quality_pct < 52 ? "low-confidence" : ""}>
              <td title={r.object_name}>{truncate(r.object_name, 50)}</td>
              <td>{r.tu_name}</td>
              <td>{r.object_type}</td>
              <td>{r.scheme || "—"}</td>
              <td>{fmtNum(r.avg_temp_gvs)}</td>
              <td>{fmtNum(r.volume_total)}</td>
              <td className={r.violation_pct > 0 ? "violation" : ""}>{fmtNum(r.violation_pct)}%</td>
              <td>{r.hours_violation_low ?? 0}</td>
              <td>{r.hours_violation_high ?? 0}</td>
              <td>{fmtNum(r.data_quality_pct)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">
        Строки с подсветкой: достоверных данных менее 52% от общего числа архивных записей за период.
      </p>
    </div>
  );
}

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

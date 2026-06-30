export default function WeeklySummaryTable({ data }) {
  if (!data?.length) {
    return <p className="empty-hint">Нет данных по неделям.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Период</th>
            <th>Объектов</th>
            <th>С некачественной поставкой</th>
            <th>Общий объём ГВС, м³</th>
            <th>Объём некачественной поставки, м³</th>
            <th>% некачественной поставки</th>
            <th>Случаев перегрева</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.period_id}>
              <td>{p.period_start} — {p.period_end}</td>
              <td>{p.objects_count}</td>
              <td>{p.objects_with_violation}</td>
              <td>{fmtNum(p.volume_total)}</td>
              <td>{fmtNum(p.violation_volume)}</td>
              <td className={p.violation_pct > 0 ? "violation" : ""}>{fmtNum(p.violation_pct)}%</td>
              <td>{p.overheat_count}</td>
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

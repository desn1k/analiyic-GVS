import { SCHEME_INFO } from "../schemeInfo";

export default function SchemeLegend({ schemes, value, onSelect }) {
  if (!schemes?.length) return null;

  return (
    <div className="table-wrap">
      <table className="scheme-legend">
        <thead>
          <tr>
            <th>Схема</th>
            <th>Откуда берём данные</th>
            <th>Когда анализируем</th>
          </tr>
        </thead>
        <tbody>
          {schemes.map((s) => {
            const info = SCHEME_INFO[s];
            return (
              <tr
                key={s}
                className={value === s ? "sorted" : ""}
                onClick={() => onSelect(value === s ? undefined : s)}
                style={{ cursor: "pointer" }}
              >
                <td>{s}</td>
                <td className="wrap-cell">{info?.source || "—"}</td>
                <td className="wrap-cell">{info?.period || "не анализируется в отчёте"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="footnote">Нажмите на строку, чтобы отфильтровать таблицу по этой схеме.</p>
    </div>
  );
}

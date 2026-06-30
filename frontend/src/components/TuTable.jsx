import { useEffect, useState } from "react";

const COLUMNS = [
  { key: "object_name", label: "Объект", wrap: true, width: "17%" },
  { key: "source_name", label: "Источник", wrap: true, width: "14%" },
  { key: "object_type", label: "Тип объекта", wrap: true, width: "11%" },
  { key: "is_dead_end", label: "Тупиковая", width: "6%" },
  { key: "system_type", label: "Схема", width: "7%" },
  { key: "avg_temp_gvs", label: "Сред. T, °C", width: "6%" },
  { key: "volume_total", label: "Объём, м³", width: "7%" },
  { key: "violation_pct", label: "% с нарушением", width: "8%" },
  { key: "hours_violation_low", label: "Часов занижение", width: "8%" },
  { key: "hours_violation_high", label: "Часов завышение", width: "8%" },
  { key: "data_quality_pct", label: "Достоверность, %", width: "8%" },
];

const PAGE_SIZES = [25, 50, 100, 250];

export default function TuTable({ rows, sortBy, order, onSort }) {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [rows]);

  if (!rows?.length) {
    return <p className="empty-hint">Нет точек учёта по выбранным фильтрам.</p>;
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div>
      <div className="pagination-bar">
        <label className="page-size-label">
          Показывать по:
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="pagination-controls">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
          <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <span className="pagination-status">
            Стр. {safePage} из {pageCount} ({rows.length} ТУ)
          </span>
          <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((p) => p + 1)}>›</button>
          <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>»</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
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
            {pageRows.map((r) => (
              <tr key={r.id} className={r.data_quality_pct < 52 ? "low-confidence" : ""}>
                <td className="wrap-cell sticky-col" title={r.object_name}>{r.object_name}</td>
                <td className="wrap-cell" title={r.source_name}>{r.source_name || "—"}</td>
                <td className="wrap-cell">{r.object_type}</td>
                <td>{fmtDeadEnd(r.is_dead_end)}</td>
                <td>{r.system_type || "—"}</td>
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
      </div>
      <p className="footnote">
        Строки с подсветкой: достоверных данных менее 52% от общего числа архивных записей за период.
      </p>
    </div>
  );
}

function fmtNum(v) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(1);
}

function fmtDeadEnd(v) {
  if (!v) return "—";
  const s = String(v).trim().toLowerCase();
  if (s === "да") return "Да";
  if (s === "нет") return "Нет";
  return v;
}

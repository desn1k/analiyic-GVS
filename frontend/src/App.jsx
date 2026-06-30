import { useEffect, useState, useCallback } from "react";
import UploadPanel from "./components/UploadPanel";
import DynamicsChart from "./components/DynamicsChart";
import FiltersBar from "./components/FiltersBar";
import TuTable from "./components/TuTable";
import WeeklySummaryTable from "./components/WeeklySummaryTable";
import ObjectComparisonTable from "./components/ObjectComparisonTable";
import { getPeriods, getDynamics, getFilters, getTuRows, getWeeklySummary, getObjectComparison } from "./api/client";
import { formatPeriod } from "./utils/format";
import "./App.css";

const searchParams = new URLSearchParams(window.location.search);
const isAnalysisView = searchParams.get("view") === "analysis";
const initialComparisonFilters = Object.fromEntries(
  [...searchParams.entries()].filter(([k]) => k !== "view")
);

export default function App() {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [dynamics, setDynamics] = useState([]);
  const [filters, setFilters] = useState(null);
  const [filterValue, setFilterValue] = useState({});
  const [sortBy, setSortBy] = useState("violation_pct");
  const [order, setOrder] = useState("desc");
  const [tuRows, setTuRows] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState([]);
  const [objectComparison, setObjectComparison] = useState(null);
  const [comparisonFilterValue, setComparisonFilterValue] = useState(initialComparisonFilters);
  const [showComparisonFilters, setShowComparisonFilters] = useState(false);

  const reload = useCallback(async () => {
    const ps = await getPeriods();
    setPeriods(ps);
    if (ps.length) setSelectedPeriod((prev) => prev || ps[ps.length - 1].id);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!selectedPeriod) return;
    getFilters(selectedPeriod).then(setFilters);
  }, [selectedPeriod]);

  useEffect(() => {
    if (!selectedPeriod) return;
    getTuRows(selectedPeriod, { ...filterValue, sort_by: sortBy, order }).then(setTuRows);
  }, [selectedPeriod, filterValue, sortBy, order]);

  useEffect(() => {
    getDynamics(filterValue).then(setDynamics);
  }, [filterValue]);

  useEffect(() => {
    getWeeklySummary(filterValue).then(setWeeklySummary);
  }, [filterValue]);

  useEffect(() => {
    getObjectComparison(comparisonFilterValue).then(setObjectComparison);
  }, [comparisonFilterValue]);

  const handleSort = (key) => {
    if (key === sortBy) setOrder(order === "desc" ? "asc" : "desc");
    else { setSortBy(key); setOrder("desc"); }
  };

  const openAnalysisTab = () => {
    const params = new URLSearchParams({ view: "analysis", ...comparisonFilterValue });
    window.open(`${window.location.pathname}?${params.toString()}`, "_blank");
  };

  if (isAnalysisView) {
    const summary = describeFilters(comparisonFilterValue);
    return (
      <div className="app">
        <header>
          <h1>Сравнение объектов по неделям</h1>
        </header>
        <section className="card">
          {summary && <p className="applied-filters">Применённые фильтры: {summary}</p>}
          <ObjectComparisonTable data={objectComparison} />
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Аналитика качества ГВС</h1>
        <UploadPanel onUploaded={reload} />
      </header>

      <section className="card">
        <h2>Динамика во времени</h2>
        <DynamicsChart data={dynamics} />
      </section>

      <section className="card">
        <h2>Сводка по неделям</h2>
        <WeeklySummaryTable data={weeklySummary} />
      </section>

      <section className="card">
        <div className="section-header-row">
          <h2>Сравнение объектов по неделям</h2>
          <button
            type="button"
            className="toggle-filters-btn"
            title="Фильтры"
            onClick={() => setShowComparisonFilters((v) => !v)}
          >
            {showComparisonFilters ? "−" : "+"}
          </button>
        </div>
        {showComparisonFilters && (
          <div className="comparison-filters-row">
            <FiltersBar filters={filters} value={comparisonFilterValue} onChange={setComparisonFilterValue} />
            <button type="button" className="analyze-btn" onClick={openAnalysisTab}>
              Анализ
            </button>
          </div>
        )}
        {!showComparisonFilters && (
          <p className="empty-hint">Раскройте фильтры (+) и нажмите «Анализ», чтобы открыть сравнение объектов по неделям в новой вкладке.</p>
        )}
      </section>

      <section className="card">
        <div className="period-select-row">
          <h2>Точки учёта</h2>
          {periods.length > 0 && (
            <select value={selectedPeriod || ""} onChange={(e) => setSelectedPeriod(Number(e.target.value))}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPeriod(p.period_start, p.period_end)} ({p.tu_count} ТУ)
                </option>
              ))}
            </select>
          )}
        </div>
        <FiltersBar filters={filters} value={filterValue} onChange={setFilterValue} />
        <TuTable rows={tuRows} sortBy={sortBy} order={order} onSort={handleSort} />
      </section>
    </div>
  );
}

function describeFilters(v) {
  const parts = [];
  if (v.source_name) parts.push(`Источник: ${v.source_name}`);
  if (v.object_type) parts.push(`Тип объекта: ${v.object_type}`);
  if (v.is_dead_end) parts.push(`Тупиковая: ${v.is_dead_end === "да" ? "Да" : "Нет"}`);
  if (v.system_type) parts.push(v.system_type);
  if (v.data_quality_preset === "reliable") parts.push("Достоверные (≥52%)");
  if (v.data_quality_preset === "unreliable") parts.push("Недостоверные (<52%)");
  if (v.search) parts.push(`Поиск: «${v.search}»`);
  return parts.join(", ");
}

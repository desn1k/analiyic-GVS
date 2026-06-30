import { useEffect, useState, useCallback } from "react";
import UploadPanel from "./components/UploadPanel";
import DynamicsChart from "./components/DynamicsChart";
import FiltersBar from "./components/FiltersBar";
import TuTable from "./components/TuTable";
import WeeklySummaryTable from "./components/WeeklySummaryTable";
import ObjectComparisonTable from "./components/ObjectComparisonTable";
import { getPeriods, getDynamics, getFilters, getTuRows, getWeeklySummary, getObjectComparison } from "./api/client";
import "./App.css";

const isAnalysisView = new URLSearchParams(window.location.search).get("view") === "analysis";

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
  const [comparisonFilterValue, setComparisonFilterValue] = useState({});
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
    window.open(`${window.location.pathname}?view=analysis`, "_blank");
  };

  if (isAnalysisView) {
    return (
      <div className="app">
        <header>
          <h1>Сравнение объектов по неделям</h1>
        </header>
        <section className="card">
          <FiltersBar filters={filters} value={comparisonFilterValue} onChange={setComparisonFilterValue} />
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
          <div className="section-header-actions">
            <button
              type="button"
              className="toggle-filters-btn"
              title="Фильтры"
              onClick={() => setShowComparisonFilters((v) => !v)}
            >
              {showComparisonFilters ? "−" : "+"}
            </button>
            <button type="button" className="analyze-btn" onClick={openAnalysisTab}>
              Анализ
            </button>
          </div>
        </div>
        {showComparisonFilters && (
          <FiltersBar filters={filters} value={comparisonFilterValue} onChange={setComparisonFilterValue} />
        )}
        <ObjectComparisonTable data={objectComparison} />
      </section>

      <section className="card">
        <div className="period-select-row">
          <h2>Точки учёта</h2>
          {periods.length > 0 && (
            <select value={selectedPeriod || ""} onChange={(e) => setSelectedPeriod(Number(e.target.value))}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.period_start} — {p.period_end} ({p.tu_count} ТУ)
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

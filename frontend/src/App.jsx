import { useEffect, useState, useCallback } from "react";
import DataTab from "./components/DataTab";
import GvsQualityAnalysis from "./components/GvsQualityAnalysis";
import WeekSourcesModal from "./components/WeekSourcesModal";
import DynamicsChart from "./components/DynamicsChart";
import FiltersBar from "./components/FiltersBar";
import TuTable from "./components/TuTable";
import WeeklySummaryTable from "./components/WeeklySummaryTable";
import ObjectComparisonTable from "./components/ObjectComparisonTable";
import {
  getPeriods, getDynamics, getFilters, getAllTuRows, getWeeklySummary,
  getObjectComparison, getDashboard,
} from "./api/client";
import "./App.css";

const searchParams = new URLSearchParams(window.location.search);
const isAnalysisView = searchParams.get("view") === "analysis";
const initialComparisonFilters = Object.fromEntries(
  [...searchParams.entries()].filter(([k]) => k !== "view")
);

const TABS = [
  { key: "data", label: "Данные" },
  { key: "quality", label: "Качество ГВС" },
  { key: "objects", label: "Объекты" },
  { key: "reports", label: "Отчёты (недельные)" },
];

export default function App() {
  const [tab, setTab] = useState("quality");
  const [dashboard, setDashboard] = useState(null);
  const [periods, setPeriods] = useState([]);
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
  const [weekSources, setWeekSources] = useState(null);

  const reload = useCallback(async () => {
    const [ps, dash] = await Promise.all([getPeriods(), getDashboard().catch(() => null)]);
    setPeriods(ps);
    setDashboard(dash);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Первый заход без данных — открываем вкладку «Данные».
  useEffect(() => {
    if (!dashboard) return;
    const has = (dashboard.device?.points_total || 0) > 0 || (dashboard.report?.periods_total || 0) > 0;
    if (!has) setTab("data");
  }, [dashboard]);

  useEffect(() => {
    if (periods.length) getFilters(periods[periods.length - 1].id).then(setFilters);
  }, [periods]);

  useEffect(() => {
    getAllTuRows({ ...filterValue, sort_by: sortBy, order }).then(setTuRows).catch(() => {});
  }, [filterValue, sortBy, order]);

  useEffect(() => { getDynamics(filterValue).then(setDynamics).catch(() => {}); }, [filterValue]);
  useEffect(() => { getWeeklySummary(filterValue).then(setWeeklySummary).catch(() => {}); }, [filterValue]);
  useEffect(() => { getObjectComparison(comparisonFilterValue).then(setObjectComparison).catch(() => {}); }, [comparisonFilterValue]);

  const handleSort = (key) => {
    if (key === sortBy) setOrder(order === "desc" ? "asc" : "desc");
    else { setSortBy(key); setOrder("desc"); }
  };

  const openAnalysisTab = () => {
    const params = new URLSearchParams({ view: "analysis", ...comparisonFilterValue });
    window.open(`${window.location.pathname}?${params.toString()}`, "_blank");
  };

  // Отдельное окно сравнения объектов (открывается в новой вкладке).
  if (isAnalysisView) {
    const summary = describeFilters(comparisonFilterValue);
    return (
      <div className="app">
        <header><h1>Сравнение объектов по неделям</h1></header>
        <section className="card">
          {summary && <p className="applied-filters">Применённые фильтры: {summary}</p>}
          <ObjectComparisonTable data={objectComparison} />
        </section>
      </div>
    );
  }

  const hasData = (dashboard?.device?.points_total || 0) > 0 || (dashboard?.report?.periods_total || 0) > 0;

  return (
    <div className="app">
      <header>
        <h1>Аналитика качества ГВС</h1>
      </header>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "data" && <DataTab dashboard={dashboard} onReload={reload} />}

      {tab !== "data" && !hasData && (
        <section className="card">
          <p className="empty-hint">
            Данных ещё нет. Перейдите на вкладку <button className="link-cell" onClick={() => setTab("data")}>«Данные»</button> и загрузите файлы.
          </p>
        </section>
      )}

      {tab === "quality" && hasData && (
        <section className="card">
          <h2>Качество ГВС по приборным данным</h2>
          <GvsQualityAnalysis dataRange={dashboard?.device} />
        </section>
      )}

      {tab === "objects" && hasData && (
        <section className="card">
          <div className="period-select-row">
            <h2>Объекты и точки учёта</h2>
          </div>
          <p className="lead-text">Найдите объект и нажмите на его название — откроется карточка с графиком, отключениями и иерархией.</p>
          <FiltersBar filters={filters} value={filterValue} onChange={setFilterValue} showOutage />
          <TuTable rows={tuRows} sortBy={sortBy} order={order} onSort={handleSort} />
        </section>
      )}

      {tab === "reports" && hasData && (
        <>
          <section className="card">
            <h2>Динамика во времени</h2>
            <DynamicsChart data={dynamics} />
          </section>
          <section className="card">
            <h2>Сводка по неделям</h2>
            <p className="lead-text">Нажмите на неделю — покажу разбивку по источникам (ЦТП/котельные).</p>
            <WeeklySummaryTable data={weeklySummary} onSelect={setWeekSources} />
          </section>
          {weekSources && <WeekSourcesModal period={weekSources} onClose={() => setWeekSources(null)} />}
          <section className="card">
            <div className="section-header-row">
              <h2>Сравнение объектов по неделям</h2>
              <button type="button" className="toggle-filters-btn" title="Фильтры" onClick={() => setShowComparisonFilters((v) => !v)}>
                {showComparisonFilters ? "−" : "+"}
              </button>
            </div>
            {showComparisonFilters ? (
              <div className="comparison-filters-row">
                <FiltersBar filters={filters} value={comparisonFilterValue} onChange={setComparisonFilterValue} />
                <button type="button" className="analyze-btn" onClick={openAnalysisTab}>Открыть сравнение</button>
              </div>
            ) : (
              <p className="empty-hint">Раскройте фильтры (+) и нажмите «Открыть сравнение», чтобы увидеть таблицу объекты × недели в новой вкладке.</p>
            )}
          </section>
        </>
      )}
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

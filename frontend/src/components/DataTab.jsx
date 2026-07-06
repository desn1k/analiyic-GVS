import UploadPanel from "./UploadPanel";
import DashboardPanel from "./DashboardPanel";

// Чек-лист загруженных данных — сразу видно, что есть, а чего не хватает.
function checklist(data) {
  const d = data?.device;
  const r = data?.report;
  return [
    { key: "device", label: "Приборные почасовые данные (T1/T2/объём)", ok: (d?.points_total || 0) > 0,
      hint: "Файл «Ведомость учёта параметров потребления тепла в системе ГВС». Нужен для анализа качества." },
    { key: "outage", label: "Ведомость отключений ГВС", ok: (d?.outages_gvs || 0) > 0,
      hint: "Плановые/аварийные отключения — их часы исключаются из анализа." },
    { key: "registry", label: "Реестр объектов (паспорта)", ok: (d?.registry_total || 0) > 0,
      hint: "Даёт связь отключений с объектами и паспортные данные (нагрузки, температуры)." },
    { key: "hierarchy", label: "Иерархия связей (потребитель → источник)", ok: (d?.hierarchy_total || 0) > 0,
      hint: "Позволяет определять причину: системная (сеть) или локальная (внутри дома)." },
    { key: "report", label: "Недельный отчёт качества (необязательно)", ok: (r?.periods_total || 0) > 0,
      hint: "Агрегированный отчёт по неделям — для раздела «Отчёты»." },
  ];
}

export default function DataTab({ dashboard, onReload }) {
  const items = checklist(dashboard);
  const loadedCount = items.filter((i) => i.ok).length;
  const hasAny = loadedCount > 0;

  return (
    <div>
      <section className="card welcome-card">
        <h2>{hasAny ? "Загрузка данных" : "Начните здесь — загрузите данные"}</h2>
        <p className="lead-text">
          Загрузите файлы Excel — приложение само определит тип каждого. Порядок не важен,
          повторная загрузка не создаёт дублей.
        </p>
        <UploadPanel onUploaded={onReload} />

        <div className="checklist">
          {items.map((i) => (
            <div key={i.key} className={`check-item ${i.ok ? "done" : ""}`}>
              <span className="check-mark">{i.ok ? "✓" : "○"}</span>
              <span className="check-label">{i.label}</span>
              <span className="check-hint">{i.hint}</span>
            </div>
          ))}
        </div>
        <p className="muted-note" style={{ marginTop: 8 }}>Загружено: {loadedCount} из {items.length}</p>
      </section>

      {hasAny && (
        <section className="card">
          <h2>Что уже в базе</h2>
          <DashboardPanel data={dashboard} onReload={onReload} />
        </section>
      )}
    </div>
  );
}

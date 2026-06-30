const DATA_QUALITY_PRESETS = [
  { value: "", label: "Достоверность: все" },
  { value: "reliable", label: "Достоверные (≥52%)" },
  { value: "unreliable", label: "Недостоверные (<52%)" },
];

export default function FiltersBar({ filters, value, onChange }) {
  if (!filters) return null;

  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value || undefined });

  const setDataQuality = (e) => {
    const preset = e.target.value;
    const next = { ...value };
    delete next.min_data_quality_pct;
    delete next.max_data_quality_pct;
    if (preset === "reliable") next.min_data_quality_pct = 52;
    if (preset === "unreliable") next.max_data_quality_pct = 51.9;
    next.data_quality_preset = preset || undefined;
    onChange(next);
  };

  return (
    <div className="filters-bar">
      <select className="source-select" value={value.source_name || ""} onChange={set("source_name")}>
        <option value="">Все источники</option>
        {filters.sources.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={value.object_type || ""} onChange={set("object_type")}>
        <option value="">Все типы объектов</option>
        {filters.object_types.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select value={value.scheme || ""} onChange={set("scheme")}>
        <option value="">Все схемы</option>
        {filters.schemes.map((s) => (
          <option key={s} value={s}>Схема {s}</option>
        ))}
      </select>
      <select value={value.system_type || ""} onChange={set("system_type")}>
        <option value="">Открытая/Закрытая</option>
        {filters.system_types.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={value.data_quality_preset || ""} onChange={setDataQuality}>
        {DATA_QUALITY_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Поиск по объекту..."
        value={value.search || ""}
        onChange={set("search")}
      />
    </div>
  );
}

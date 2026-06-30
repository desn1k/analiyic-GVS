export default function FiltersBar({ filters, value, onChange }) {
  if (!filters) return null;

  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value || undefined });

  return (
    <div className="filters-bar">
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
      <input
        type="text"
        placeholder="Поиск по объекту..."
        value={value.search || ""}
        onChange={set("search")}
      />
    </div>
  );
}

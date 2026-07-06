// Единая цветовая легенда для всех графиков и таблиц.
const ITEMS = [
  { color: "#dc2626", label: "нарушение / недогрев" },
  { color: "#fde047", label: "пограничное 40–60 °C" },
  { color: "#16a34a", label: "норма 60–75 °C" },
  { color: "#f59e0b", label: "ограничение (отключение)" },
  { color: "#9ca3af", label: "нет данных / иное" },
];

export default function ColorLegend({ only }) {
  const items = only ? ITEMS.filter((i) => only.includes(i.label)) : ITEMS;
  return (
    <div className="color-legend">
      {items.map((i) => (
        <span className="legend-chip" key={i.label}>
          <span className="legend-dot" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

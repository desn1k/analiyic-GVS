import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";

export default function DynamicsChart({ data }) {
  if (!data?.length) {
    return <p className="empty-hint">Нет данных для графика — загрузите хотя бы один отчёт.</p>;
  }

  const chartData = data.map((d) => ({
    period: `${fmt(d.period_start)} – ${fmt(d.period_end)}`,
    "% объёма с нарушением": d.violation_pct,
    "Средняя темп. ГВС, °C": d.avg_temp_gvs,
    "Объём, м³": d.volume_total,
  }));

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" angle={-20} textAnchor="end" height={70} fontSize={12} />
        <YAxis yAxisId="left" label={{ value: "%  /  °C", angle: -90, position: "insideLeft" }} />
        <YAxis yAxisId="right" orientation="right" label={{ value: "м³", angle: 90, position: "insideRight" }} />
        <Tooltip />
        <Legend />
        <Bar yAxisId="right" dataKey="Объём, м³" fill="#cfe3ff" barSize={28} />
        <Line yAxisId="left" type="monotone" dataKey="% объёма с нарушением" stroke="#d9480f" strokeWidth={2} dot />
        <Line yAxisId="left" type="monotone" dataKey="Средняя темп. ГВС, °C" stroke="#1971c2" strokeWidth={2} dot />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function fmt(d) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y.slice(2)}`;
}

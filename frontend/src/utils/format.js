const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function parse(d) {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}

export function formatPeriod(startStr, endStr) {
  const start = parse(startStr);
  const end = parse(endStr);

  if (start.y === end.y && start.m === end.m) {
    return `${start.day}-${end.day} ${MONTHS[start.m - 1]} ${start.y}`;
  }
  if (start.y === end.y) {
    return `${start.day} ${MONTHS[start.m - 1]} - ${end.day} ${MONTHS[end.m - 1]} ${start.y}`;
  }
  return `${start.day} ${MONTHS[start.m - 1]} ${start.y} - ${end.day} ${MONTHS[end.m - 1]} ${end.y}`;
}

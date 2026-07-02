import { useRef, useState } from "react";
import { uploadReport, getDeviceUpload } from "../api/client";
import { formatPeriod } from "../utils/format";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function UploadPanel({ onUploaded }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStatus("Загрузка файла на сервер...");
    try {
      const res = await uploadReport(file);
      if (res.kind === "report") {
        const period = res.report;
        setStatus(`Загружено: ${formatPeriod(period.period_start, period.period_end)} (${period.tu_count} ТУ)`);
        onUploaded?.();
        window.location.reload();
        return;
      }

      // device / outage / registry — разбираются в фоне, опрашиваем статус.
      const KIND_LABEL = {
        device: "приборных данных",
        outage: "ведомости отключений",
        registry: "реестра объектов",
      };
      const label = KIND_LABEL[res.kind] || "данных";
      setStatus(`Файл загружен. Идёт разбор ${label}...`);
      let up = res.device;
      while (up.status === "processing") {
        await sleep(3000);
        up = await getDeviceUpload(up.id);
        setStatus(`Разбор ${label}... обработано записей: ${up.points_count}`);
      }
      if (up.status === "error") {
        setStatus(`Ошибка разбора: ${up.error || "неизвестная ошибка"}`);
        return;
      }
      setStatus(`Готово (${label}): записей ${up.points_count}`);
      onUploaded?.();
      window.location.reload();
    } catch (e) {
      setStatus(`Ошибка: ${e.response?.data?.detail || e.message}`);
    }
  };

  return (
    <div className="upload-panel">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <button onClick={() => inputRef.current.click()}>+ Загрузить отчёт (xlsx)</button>
      {status && <span className="upload-status">{status}</span>}
    </div>
  );
}

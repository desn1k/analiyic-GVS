import { useRef, useState } from "react";
import { uploadReport } from "../api/client";
import { formatPeriod } from "../utils/format";

export default function UploadPanel({ onUploaded }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStatus("Загрузка...");
    try {
      const period = await uploadReport(file);
      setStatus(`Загружено: ${formatPeriod(period.period_start, period.period_end)} (${period.tu_count} ТУ)`);
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
